/**
 * SPOUZY Development Staff Accounts Seeder
 * Creates or resets local development accounts for:
 * - Operations Staff (operations@spouzy.test)
 * - Clinical Director (clinical@spouzy.test)
 * - Content Editor (content@spouzy.test)
 *
 * Requirements:
 * - Refuses execution in production environment.
 * - Idempotent: re-running does NOT overwrite existing passwords unless --reset is passed.
 * - Generates secure random temporary passwords and displays them ONCE in terminal.
 * - Sets must_change_password = true.
 * - Preserves existing administrator account untouched.
 */

const crypto = require('crypto');
const models = require('../models');
const { hashPassword } = require('../config/security');

function generateSecureTempPassword() {
  const lettersUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lettersLower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  // Ensure character diversity
  let pass = '';
  pass += lettersUpper[crypto.randomInt(0, lettersUpper.length)];
  pass += lettersLower[crypto.randomInt(0, lettersLower.length)];
  pass += numbers[crypto.randomInt(0, numbers.length)];
  pass += symbols[crypto.randomInt(0, symbols.length)];

  // Fill up to 14 chars
  const all = lettersUpper + lettersLower + numbers + symbols;
  for (let i = 0; i < 10; i++) {
    pass += all[crypto.randomInt(0, all.length)];
  }

  // Shuffle
  return pass.split('').sort(() => 0.5 - Math.random()).join('');
}

const DEV_ACCOUNTS = [
  {
    email: 'operations@spouzy.test',
    first_name: 'Operations',
    last_name: 'Coordinator',
    phone: '+91 98200 11001',
    role_slug: 'operations_staff',
    role_name: 'Operations Staff'
  },
  {
    email: 'clinical@spouzy.test',
    first_name: 'Clinical',
    last_name: 'Director',
    phone: '+91 98200 11002',
    role_slug: 'clinical_director',
    role_name: 'Clinical Director'
  },
  {
    email: 'content@spouzy.test',
    first_name: 'Content',
    last_name: 'Editor',
    phone: '+91 98200 11003',
    role_slug: 'content_editor',
    role_name: 'Content Editor'
  }
];

async function seedDevUsers() {
  // Safety guard: refuse in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY VIOLATION: Development staff account seeder cannot run in production.');
  }

  await models.sequelize.authenticate();
  console.log('===============================================================');
  console.log('   SPOUZY LOCAL DEVELOPMENT STAFF ACCOUNT SEEDER               ');
  console.log('===============================================================');

  const isReset = process.argv.includes('--reset') || process.env.RESET_DEV_USERS === 'true';
  const createdCredentials = [];

  for (const acc of DEV_ACCOUNTS) {
    // 1. Resolve role
    let role = await models.Role.findOne({ where: { slug: acc.role_slug } });
    if (!role) {
      console.log(`Role "${acc.role_slug}" not found; creating it...`);
      role = await models.Role.create({
        slug: acc.role_slug,
        name: acc.role_name,
        description: `Development role for ${acc.role_name}`,
        permissions: []
      });
    }

    // 2. Check existing user
    let user = await models.User.findOne({ where: { email: acc.email } });

    if (user && !isReset) {
      console.log(`- ${acc.email} (${acc.role_name}): Already exists (ID: ${user.id}). Password preserved untouched.`);
      continue;
    }

    const tempPassword = generateSecureTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    if (user && isReset) {
      await user.update({
        password_hash: passwordHash,
        role_id: role.id,
        is_active: true,
        must_change_password: true
      });
      console.log(`- ${acc.email}: Existing account password reset.`);
    } else {
      user = await models.User.create({
        email: acc.email,
        password_hash: passwordHash,
        first_name: acc.first_name,
        last_name: acc.last_name,
        phone: acc.phone,
        role_id: role.id,
        is_active: true,
        must_change_password: true
      });
      console.log(`- ${acc.email}: Account created.`);
    }

    createdCredentials.push({
      email: acc.email,
      role: acc.role_name,
      tempPassword,
      mustChange: true
    });
  }

  console.log('\n===============================================================');
  if (createdCredentials.length > 0) {
    console.log('NEWLY GENERATED TEMPORARY CREDENTIALS (DISPLAYED ONCE):');
    console.log('Copy these now; they will not be displayed again or written to disk.\n');
    console.table(createdCredentials.map(c => ({
      'Email / Login ID': c.email,
      'Role': c.role,
      'Temporary Password': c.tempPassword,
      'Change on 1st Login': c.mustChange ? 'YES' : 'NO'
    })));
  } else {
    console.log('All development accounts already exist. No passwords were changed.');
    console.log('To explicitly reset development passwords, run with --reset flag:');
    console.log('  npm run seed:dev-users -- --reset');
  }
  console.log('===============================================================\n');

  return createdCredentials;
}

if (require.main === module) {
  seedDevUsers()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Failed to seed dev users:', err.message);
      process.exit(1);
    });
}

module.exports = { seedDevUsers };
