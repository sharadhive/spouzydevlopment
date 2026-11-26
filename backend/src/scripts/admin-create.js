const readline = require('readline');
const models = require('../models');
const { hashPassword } = require('../config/security');

function askQuestion(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, ans => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function createAdmin() {
  await models.sequelize.authenticate();

  const adminRole = await models.Role.findOne({ where: { slug: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin role not found. Please run migrations and seeds first: npm run db:setup');
  }

  const isInteractive = process.stdin.isTTY;

  // Check inputs from env or prompt
  let email = process.env.ADMIN_EMAIL;
  if (!email && isInteractive) {
    email = await askQuestion('Enter Admin Email [default: admin@spouzy.com]: ');
  }
  email = email || 'admin@spouzy.com';
  
  const existingUser = await models.User.findOne({ where: { email } });
  if (existingUser) {
    console.log(`User with email "${email}" already exists (ID: ${existingUser.id}, Role ID: ${existingUser.role_id}).`);
    let updateAns = process.env.ADMIN_FORCE_UPDATE;
    if (!updateAns && isInteractive) {
      updateAns = await askQuestion('Would you like to reset this user\'s password to a new value? (y/N): ');
    }
    if ((updateAns || '').toLowerCase() !== 'y') {
      console.log('Aborting. Existing admin account was preserved untouched.');
      return;
    }
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password && isInteractive) {
    password = await askQuestion('Enter Admin Password (min 8 chars): ');
  }
  if (!password || password.length < 8) {
    throw new Error('Admin password must be provided and be at least 8 characters long.');
  }

  let firstName = process.env.ADMIN_FIRST_NAME;
  if (!firstName && isInteractive) {
    firstName = await askQuestion('Enter First Name [default: SPOUZY]: ');
  }
  firstName = firstName || 'SPOUZY';

  let lastName = process.env.ADMIN_LAST_NAME;
  if (!lastName && isInteractive) {
    lastName = await askQuestion('Enter Last Name [default: Administrator]: ');
  }
  lastName = lastName || 'Administrator';

  const phone = process.env.ADMIN_PHONE || '+918591945055';

  const passwordHash = await hashPassword(password);

  if (existingUser) {
    existingUser.password_hash = passwordHash;
    existingUser.role_id = adminRole.id;
    existingUser.is_active = true;
    await existingUser.save();
    console.log(`Successfully updated admin user password for "${email}".`);
  } else {
    const newUser = await models.User.create({
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone,
      role_id: adminRole.id,
      is_active: true
    });
    console.log(`Successfully created Administrator account "${email}" (ID: ${newUser.id}).`);
  }

  console.log('You can now log in to the admin panel with these credentials.');
}

if (require.main === module) {
  createAdmin()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Admin creation failed:', err.message);
      process.exit(1);
    });
}

module.exports = { createAdmin };
