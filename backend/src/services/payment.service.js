const crypto = require('crypto');
const { Op } = require('sequelize');
const Razorpay = require('razorpay');
const { PaymentGatewayConfig, PaymentOrder, PaymentTransaction, Appointment, AppointmentStatusHistory, sequelize } = require('../models');
const { encryptSecret, decryptSecret } = require('../config/security');
const config = require('../config/environment');

class PaymentService {
  /**
   * Get active gateway configuration
   */
  async getActiveGatewayConfig(raw = false) {
    let gatewayConfig = await PaymentGatewayConfig.findOne({
      where: { is_active: true },
      order: [['id', 'DESC']]
    });

    if (!gatewayConfig) {
      // Check if environment has credentials
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        return {
          id: null,
          provider: 'razorpay',
          mode: process.env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'live' : 'test',
          key_id: process.env.RAZORPAY_KEY_ID,
          secret: process.env.RAZORPAY_KEY_SECRET,
          webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
          is_active: true,
          version: 1,
          isEnvFallback: true
        };
      }
      return null;
    }

    if (raw) {
      return {
        id: gatewayConfig.id,
        provider: gatewayConfig.provider,
        mode: gatewayConfig.mode,
        key_id: gatewayConfig.key_id,
        secret: decryptSecret(gatewayConfig.encrypted_secret),
        webhook_secret: decryptSecret(gatewayConfig.encrypted_webhook_secret),
        is_active: gatewayConfig.is_active,
        version: gatewayConfig.version
      };
    }

    // Masked for admin presentation
    const rawSecret = decryptSecret(gatewayConfig.encrypted_secret) || '';
    const maskedSecret = rawSecret.length > 8 
      ? `${rawSecret.slice(0, 4)}••••••••${rawSecret.slice(-4)}`
      : '••••••••';

    return {
      id: gatewayConfig.id,
      provider: gatewayConfig.provider,
      mode: gatewayConfig.mode,
      key_id: gatewayConfig.key_id,
      masked_secret: maskedSecret,
      has_webhook_secret: !!gatewayConfig.encrypted_webhook_secret,
      is_active: gatewayConfig.is_active,
      version: gatewayConfig.version,
      updated_at: gatewayConfig.updatedAt
    };
  }

  /**
   * Update or create gateway configuration
   */
  async saveGatewayConfig({ provider = 'razorpay', mode = 'test', key_id, secret, webhook_secret, is_active = true }) {
    const existing = await PaymentGatewayConfig.findOne({ order: [['id', 'DESC']] });
    const active = is_active === undefined ? true : (is_active === true || is_active === 'true' || is_active === 1 || is_active === '1');
    const keyId = String(key_id || (existing ? existing.key_id : '') || '').trim();
    const errors = {};

    if (provider !== 'razorpay') errors.provider = 'Only the Razorpay driver is supported.';
    if (!['test', 'live'].includes(mode)) errors.mode = 'Mode must be test or live.';
    if (active) {
      // Turning the driver on: the keys must be real Razorpay keys for the selected mode
      if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
        errors.key_id = 'Enter the Razorpay Key ID (starts with rzp_test_ or rzp_live_).';
      } else if (!keyId.startsWith(`rzp_${mode}_`)) {
        errors.key_id = `This key is not a ${mode} key. Choose the matching mode or paste the rzp_${mode}_ key.`;
      }
      if (!secret && !(existing && existing.encrypted_secret)) errors.secret = 'Enter the Razorpay Key Secret.';
    }
    if (Object.keys(errors).length) {
      const err = new Error(Object.values(errors)[0]);
      err.status = 400;
      err.errors = errors;
      throw err;
    }

    const encryptedSecret = secret ? encryptSecret(String(secret).trim()) : (existing ? existing.encrypted_secret : '');
    const encryptedWebhook = webhook_secret ? encryptSecret(String(webhook_secret).trim()) : (existing ? existing.encrypted_webhook_secret : null);

    if (existing) {
      await existing.update({
        provider,
        mode,
        key_id: keyId,
        encrypted_secret: encryptedSecret,
        encrypted_webhook_secret: encryptedWebhook,
        is_active: active,
        version: (existing.version || 0) + 1
      });
    } else {
      await PaymentGatewayConfig.create({
        provider,
        mode,
        key_id: keyId,
        encrypted_secret: encryptedSecret,
        encrypted_webhook_secret: encryptedWebhook,
        is_active: active,
        version: 1
      });
    }

    return this.getGatewayConfigForAdmin();
  }

  /**
   * Latest saved driver (active or not) for the admin screen, plus whether the
   * website currently takes online payments. Secrets are masked.
   */
  async getGatewayConfigForAdmin() {
    const row = await PaymentGatewayConfig.findOne({ order: [['id', 'DESC']] });
    const onlineEnabled = await this.isOnlinePaymentEnabled();
    const usingEnv = !row && !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    const base = {
      online_enabled: onlineEnabled,
      using_env_keys: usingEnv,
      website_message: onlineEnabled
        ? 'Online payment is live on the website. Paid bookings are held for 15 minutes while the client pays.'
        : 'The website shows "Online payment integration is coming soon". Paid bookings are reserved with payment pending.',
      webhook_url_path: '/api/payments/webhook'
    };
    if (!row) {
      return { ...base, id: null, provider: 'razorpay', mode: 'test', key_id: usingEnv ? process.env.RAZORPAY_KEY_ID : '', masked_secret: '', has_secret: usingEnv, has_webhook_secret: !!process.env.RAZORPAY_WEBHOOK_SECRET, is_active: usingEnv };
    }
    let rawSecret = '';
    try { rawSecret = decryptSecret(row.encrypted_secret) || ''; } catch (e) { rawSecret = ''; }
    return {
      ...base,
      id: row.id,
      provider: row.provider,
      mode: row.mode,
      key_id: row.key_id,
      masked_secret: rawSecret ? (rawSecret.length > 8 ? `${rawSecret.slice(0, 4)}••••••••${rawSecret.slice(-4)}` : '••••••••') : '',
      has_secret: !!rawSecret,
      has_webhook_secret: !!row.encrypted_webhook_secret,
      is_active: !!row.is_active,
      version: row.version,
      updated_at: row.updatedAt
    };
  }

  /**
   * Create Razorpay client instance
   */
  async getRazorpayClient() {
    const gateway = await this.getActiveGatewayConfig(true);
    if (!gateway || !gateway.key_id || !gateway.secret) {
      return null;
    }
    return {
      client: new Razorpay({
        key_id: gateway.key_id,
        key_secret: gateway.secret
      }),
      config: gateway
    };
  }

  /**
   * The payment "driver" is enabled only when an active gateway config has a real
   * key id and secret (not empty / not the placeholder values from .env.example).
   */
  async isOnlinePaymentEnabled() {
    const gateway = await this.getActiveGatewayConfig(true);
    if (!gateway || !gateway.is_active) return false;
    const keyId = String(gateway.key_id || '');
    const secret = String(gateway.secret || '');
    if (!keyId || !secret) return false;
    if (/placeholder/i.test(keyId) || /placeholder/i.test(secret)) return false;
    return /^rzp_(test|live)_/.test(keyId);
  }

  /**
   * Public, secret-free payment status for the website.
   */
  async getPublicConfig() {
    const enabled = await this.isOnlinePaymentEnabled();
    if (!enabled) {
      return {
        enabled: false,
        provider: null,
        message: 'Online payment integration is coming soon. You can still reserve a paid slot; our team will contact you to complete payment.'
      };
    }
    const gateway = await this.getActiveGatewayConfig(true);
    return {
      enabled: true,
      provider: gateway.provider || 'razorpay',
      mode: gateway.mode,
      keyId: gateway.key_id,
      checkoutScript: 'https://checkout.razorpay.com/v1/checkout.js'
    };
  }

  /**
   * Create a payment order for a paid appointment. The amount ALWAYS comes from the
   * appointment record (never from the browser).
   */
  async createOrderForAppointment({ appointmentReference }) {
    if (!appointmentReference) {
      const err = new Error('Appointment reference is required.');
      err.status = 400;
      throw err;
    }
    const enabled = await this.isOnlinePaymentEnabled();
    if (!enabled) {
      const err = new Error('Online payment is not available yet. Our team will contact you to complete payment.');
      err.status = 409;
      throw err;
    }
    const appointment = await Appointment.findOne({ where: { reference_no: String(appointmentReference) } });
    if (!appointment) {
      const err = new Error('Appointment not found.');
      err.status = 404;
      throw err;
    }
    if (appointment.booking_type !== 'paid' || !appointment.amount_minor_units) {
      const err = new Error('This appointment does not require payment.');
      err.status = 400;
      throw err;
    }
    if (appointment.payment_status === 'paid') {
      const err = new Error('This appointment is already paid.');
      err.status = 409;
      throw err;
    }
    if (appointment.status === 'hold' && appointment.hold_expires_at && new Date(appointment.hold_expires_at) <= new Date()) {
      const err = new Error('Your slot hold has expired. Please choose the slot again.');
      err.status = 410;
      throw err;
    }
    if (!['hold', 'confirmed'].includes(appointment.status)) {
      const err = new Error('This appointment can no longer be paid online.');
      err.status = 409;
      throw err;
    }

    const order = await this.createPaymentOrder({
      appointmentId: appointment.id,
      amountMinorUnits: appointment.amount_minor_units,
      currency: 'INR',
      strict: true
    });
    return {
      ...order,
      appointmentReference: appointment.reference_no,
      prefill: { name: appointment.client_name, email: appointment.client_email, contact: appointment.client_mobile },
      holdExpiresAt: appointment.hold_expires_at
    };
  }

  /**
   * Create an order (internal). In production a failed gateway call is an error;
   * outside production it falls back to a local mock order for testing.
   */
  async createPaymentOrder({ appointmentId, packageOrderId, amountMinorUnits, currency = 'INR', strict = false }) {
    const orderReference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rzp = await this.getRazorpayClient();

    let gatewayOrderId = null;

    if (rzp) {
      try {
        const rzpOrder = await rzp.client.orders.create({
          amount: amountMinorUnits,
          currency: currency,
          receipt: orderReference,
          notes: {
            appointmentId: String(appointmentId || ''),
            packageOrderId: String(packageOrderId || '')
          }
        });
        gatewayOrderId = rzpOrder.id;
      } catch (err) {
        const reason = (err && (err.message || (err.error && err.error.description))) || 'unknown error';
        if (strict && config.isProd) {
          const e = new Error('The payment gateway could not create an order. Please try again in a moment.');
          e.status = 502;
          throw e;
        }
        console.warn('[PaymentService] Razorpay order creation failed, using a local test order:', reason);
        gatewayOrderId = `mock_${orderReference}`;
      }
    } else {
      if (strict && config.isProd) {
        const e = new Error('Online payment is not configured.');
        e.status = 409;
        throw e;
      }
      gatewayOrderId = `mock_${orderReference}`;
    }

    const order = await PaymentOrder.create({
      order_reference: orderReference,
      appointment_id: appointmentId || null,
      package_order_id: packageOrderId || null,
      gateway_order_id: gatewayOrderId,
      amount_minor_units: amountMinorUnits,
      currency: currency,
      status: 'created',
      gateway_config_version: rzp ? rzp.config.version : 1
    });

    return {
      orderId: order.id,
      orderReference: order.order_reference,
      gatewayOrderId: order.gateway_order_id,
      amount: order.amount_minor_units,
      currency: order.currency,
      keyId: rzp ? rzp.config.key_id : (process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder')
    };
  }

  /**
   * Verify signature from Razorpay checkout
   */
  async verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, gatewaySignature, orderReference }) {
    const gateway = await this.getActiveGatewayConfig(true);
    const secret = gateway ? gateway.secret : (process.env.RAZORPAY_KEY_SECRET || '');

    // Look up the order
    const where = {};
    if (orderReference) where.order_reference = orderReference;
    if (gatewayOrderId) where.gateway_order_id = gatewayOrderId;

    const order = await PaymentOrder.findOne({ where, include: [{ model: Appointment, as: 'appointment' }] });
    if (!order) {
      throw new Error('Payment order not found');
    }
    if (order.status === 'paid') {
      return { success: true, message: 'Payment already verified', orderId: order.id, alreadyPaid: true };
    }

    gatewayPaymentId = String(gatewayPaymentId || '');
    let isValid = false;
    if (secret && gatewaySignature && !gatewayPaymentId.startsWith('mock_')) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(`${gatewayOrderId}|${gatewayPaymentId}`);
      const digest = hmac.digest('hex');
      try {
        isValid = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(gatewaySignature));
      } catch (e) {
        isValid = false;
      }
    } else if (!config.isProd && (gatewayPaymentId.startsWith('mock_') || !secret)) {
      // Local development / tests only: allow mock confirmation without real keys
      isValid = true;
    }

    if (!isValid) {
      await order.update({ status: 'failed' });
      await PaymentTransaction.create({
        payment_order_id: order.id,
        gateway_payment_id: gatewayPaymentId || 'unknown',
        gateway_signature: gatewaySignature || null,
        amount_minor_units: order.amount_minor_units,
        status: 'failed',
        raw_payload: { error: 'Invalid HMAC signature' }
      });
      await require('./notification.service').notify('payment_failed', {
        title: `Payment could not be verified · ₹${Math.round(order.amount_minor_units / 100).toLocaleString('en-IN')}`,
        message: `Payment ${order.order_reference}${order.package_order_id ? ' for a package order' : order.appointment_id ? ' for an appointment' : ''} was not confirmed (signature did not match). No money is recorded; check Razorpay if the customer says they paid.`,
        link: order.package_order_id ? '/shop?tab=orders' : '/appointments',
        entityType: 'PaymentOrder',
        entityId: order.id,
        amountMinor: order.amount_minor_units
      });
      return { success: false, message: 'Invalid payment signature' };
    }

    // Success: update order and appointment in transaction
    const t = await sequelize.transaction();
    try {
      await order.update({ status: 'paid' }, { transaction: t });
      await PaymentTransaction.create({
        payment_order_id: order.id,
        gateway_payment_id: gatewayPaymentId,
        gateway_signature: gatewaySignature,
        amount_minor_units: order.amount_minor_units,
        status: 'success',
        raw_payload: { verifiedAt: new Date().toISOString() }
      }, { transaction: t });

      let appointmentResult = null;
      let packageOrderResult = null;
      if (order.appointment_id) {
        appointmentResult = await this.markAppointmentPaid(order.appointment_id, `Payment verified (${gatewayPaymentId})`, t);
      }
      if (order.package_order_id) {
        packageOrderResult = await this.markPackageOrderPaid(order.package_order_id, `Payment verified (${gatewayPaymentId})`, t);
      }

      await t.commit();
      // The bill is created now (staff check and send it); never blocks the payment
      await require('./billing.service').onPaymentReceived(order.id);
      return {
        success: true,
        message: packageOrderResult ? 'Payment verified and package order confirmed' : 'Payment verified and appointment confirmed',
        orderId: order.id,
        appointment: appointmentResult,
        packageOrder: packageOrderResult
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Mark an appointment as paid and confirm it (inside a transaction).
   * If its hold had already expired and was released, it is re-confirmed only when the
   * practitioner is still free; otherwise staff are alerted through internal notes.
   */
  async markAppointmentPaid(appointmentId, note, t) {
    const appointment = await Appointment.findByPk(appointmentId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!appointment) return null;
    const previous = appointment.status;
    const updates = { payment_status: 'paid' };

    if (['hold', 'requested'].includes(previous)) {
      updates.status = 'confirmed';
      updates.hold_expires_at = null;
    } else if (previous === 'cancelled') {
      const clash = await Appointment.findOne({
        where: {
          id: { [Op.ne]: appointment.id },
          appointment_date: appointment.appointment_date,
          practitioner_id: appointment.practitioner_id,
          status: { [Op.in]: ['confirmed', 'completed', 'rescheduled', 'hold'] },
          start_time: { [Op.lt]: appointment.end_time },
          end_time: { [Op.gt]: appointment.start_time }
        },
        transaction: t
      });
      if (!clash) {
        updates.status = 'confirmed';
        updates.hold_expires_at = null;
      } else {
        updates.internal_notes = `${appointment.internal_notes ? appointment.internal_notes + '\n' : ''}PAYMENT RECEIVED AFTER HOLD EXPIRED — slot was taken. Rebook or refund. (${new Date().toISOString()})`;
      }
    }

    await appointment.update(updates, { transaction: t });
    if (updates.status && updates.status !== previous) {
      await AppointmentStatusHistory.create({
        appointment_id: appointment.id,
        previous_status: previous,
        new_status: updates.status,
        changed_by_user_id: null,
        notes: note
      }, { transaction: t });
    }
    return { referenceNo: appointment.reference_no, status: appointment.status, paymentStatus: appointment.payment_status };
  }

  /**
   * Mark a customer package order as paid and remove its packages from the customer's cart.
   * Payment received for an order that was replaced or cancelled is still recorded (money was taken).
   */
  async markPackageOrderPaid(packageOrderId, note, t) {
    const { PackageOrder, CartItem } = require('../models');
    const order = await PackageOrder.findByPk(packageOrderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) return null;
    const wasCancelled = order.status === 'cancelled';
    const notes = `${order.internal_notes ? order.internal_notes + '\n' : ''}${note}${wasCancelled ? ' — PAID AFTER CANCELLATION, please review.' : ''}`;
    await order.update({ status: 'paid', payment_status: 'paid', paid_at: new Date(), internal_notes: notes }, { transaction: t });
    let items = order.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
    const ids = (Array.isArray(items) ? items : []).map(i => i.package_id).filter(Boolean);
    if (ids.length) await CartItem.destroy({ where: { user_id: order.user_id, package_id: ids }, transaction: t });
    const activityService = require('./activity.service');
    await activityService.record(order.user_id, 'payment', { label: `${order.order_no} · ₹${Math.round(order.total_minor / 100)}`, details: { order_no: order.order_no } });
    return { orderNo: order.order_no, status: order.status, paymentStatus: order.payment_status };
  }

  /**
   * Verify and process webhook
   */
  async handleWebhook(rawBodyBuffer, signatureHeader) {
    const gateway = await this.getActiveGatewayConfig(true);
    const webhookSecret = gateway ? gateway.webhook_secret : process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Webhook secret is not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBodyBuffer)
      .digest('hex');

    const signatureMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signatureHeader || '')
    );

    if (!signatureMatch) {
      throw new Error('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBodyBuffer.toString('utf8'));
    const event = payload.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload.payment.entity;
      const gatewayOrderId = paymentEntity.order_id;
      const gatewayPaymentId = paymentEntity.id;

      const order = await PaymentOrder.findOne({ where: { gateway_order_id: gatewayOrderId } });
      if (order && order.status !== 'paid') {
        const t = await sequelize.transaction();
        try {
          await order.update({ status: 'paid' }, { transaction: t });
          await PaymentTransaction.create({
            payment_order_id: order.id,
            gateway_payment_id: gatewayPaymentId,
            amount_minor_units: paymentEntity.amount,
            status: 'success',
            raw_payload: payload
          }, { transaction: t });

          if (order.appointment_id) {
            await this.markAppointmentPaid(order.appointment_id, `Payment captured via webhook (${event})`, t);
          }
          if (order.package_order_id) {
            await this.markPackageOrderPaid(order.package_order_id, `Payment captured via webhook (${event})`, t);
          }
          await t.commit();
          await require('./billing.service').onPaymentReceived(order.id);
        } catch (e) {
          await t.rollback();
          throw e;
        }
      }
    }

    return { received: true };
  }
}

module.exports = new PaymentService();
