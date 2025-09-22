// account.service.js
const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sendEmail = require('_helpers/send-email');
const db = require('_helpers/db');
const Role = require('_helpers/role');

module.exports = {
  authenticate,
  refreshToken,
  revokeToken,
  register,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

// ------------------------- Authentication -------------------------

async function authenticate({ email, password, ipAddress }) {
  const account = await db.Account.scope('withHash').findOne({ where: { email } });
  if (!account) throw 'Account not found';
  if (account.status && account.status.toLowerCase() === 'inactive') throw 'This account is inactive';
  if (!account.passwordHash) throw 'This account does not have a password set';
  if (!(await bcrypt.compare(password, account.passwordHash))) throw 'Invalid password';

  const jwtToken = generateJwtToken(account);
  const refreshToken = generateRefreshToken(account, ipAddress);
  await refreshToken.save();

  return {
    ...basicDetails(account),
    jwtToken,
    refreshToken: refreshToken.token
  };
}

async function refreshToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);
  const account = await refreshToken.getAccount();

  const newRefreshToken = generateRefreshToken(account, ipAddress);
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  refreshToken.replacedByToken = newRefreshToken.token;

  await refreshToken.save();
  await newRefreshToken.save();

  const jwtToken = generateJwtToken(account);

  return {
    ...basicDetails(account),
    jwtToken,
    refreshToken: newRefreshToken.token
  };
}

async function revokeToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
}

// ------------------------- Registration / Verification -------------------------

async function register(params, origin) {
  if (await db.Account.findOne({ where: { email: params.email } })) {
    return await sendAlreadyRegisteredEmail(params.email, origin);
  }

  const account = new db.Account(params);

  const isFirstAccount = (await db.Account.count()) === 0;
  account.role = isFirstAccount ? Role.Admin : Role.User;
  account.verificationToken = randomTokenString();
  account.passwordHash = await hash(params.password);

  await account.save();
  await sendVerificationEmail(account, origin);
}

async function verifyEmail({ token }) {
  const account = await db.Account.findOne({ where: { verificationToken: token } });
  if (!account) throw 'Verification failed';

  account.verified = Date.now();
  account.verificationToken = null;
  await account.save();
}

// ------------------------- Password reset -------------------------

async function forgotPassword({ email }, origin) {
  const account = await db.Account.findOne({ where: { email } });
  if (!account) return; // always OK

  account.resetToken = randomTokenString();
  account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await account.save();

  await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
  const account = await db.Account.findOne({
    where: { resetToken: token, resetTokenExpires: { [Op.gt]: Date.now() } }
  });
  if (!account) throw 'Invalid token';
  return account;
}

async function resetPassword({ token, password, confirmPassword }) {
  const account = await validateResetToken({ token });
  if (!password) throw 'Password is required';
  if (!confirmPassword) throw 'Confirm password is required';
  if (password !== confirmPassword) throw 'Passwords do not match';

  account.passwordHash = await hash(password);
  account.passwordReset = Date.now();
  account.resetToken = null;
  await account.save();
}

// ------------------------- CRUD -------------------------

async function getAll() {
  return await db.Account.findAll({
    attributes: ['id', 'title', 'firstName', 'lastName', 'email', 'role', 'status', 'created', 'updated', 'isVerified']
  });
}

async function getById(id) {
  const account = await getAccount(id);
  return account ? basicDetails(account) : null;
}

async function create(params) {
  console.log('Incoming create params:', params);

  // check email
  if (await db.Account.findOne({ where: { email: params.email } })) {
    throw `Email "${params.email}" is already registered`;
  }

  // ✅ enforce password requirements
  if (!params.password) throw 'Password is required';
  if (!params.confirmPassword) throw 'Confirm password is required';
  if (params.password !== params.confirmPassword) {
    throw 'Passwords do not match';
  }

  // build account
  const account = new db.Account({
    title: params.title,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    role: params.role,
    status: params.status,
    verified: Date.now(), // ✅ admin-created accounts are auto-verified
    passwordHash: await hash(params.password)
  });

  await account.save();
  return basicDetails(account);
}

async function update(id, params) {
  const account = await getAccount(id);
  if (!account) throw 'Account not found';

  if (params.email && account.email !== params.email &&
      await db.Account.findOne({ where: { email: params.email } })) {
    throw `Email "${params.email}" is already taken`;
  }

  if (params.password || params.confirmPassword) {
    if (!params.password) throw 'Password is required';
    if (!params.confirmPassword) throw 'Confirm password is required';
    if (params.password !== params.confirmPassword) {
      throw 'Passwords do not match';
    }
    params.passwordHash = await hash(params.password);
  }

  Object.assign(account, params);
  account.updated = Date.now();
  await account.save();

  return basicDetails(account);
}

async function _delete(id) {
  const account = await getAccount(id);
  if (!account) throw 'Account not found';
  await account.destroy();
}

// ------------------------- Helpers -------------------------

async function getAccount(id) {
  return await db.Account.findByPk(id);
}

async function getRefreshToken(token) {
  const refreshToken = await db.RefreshToken.findOne({ where: { token } });
  if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
  return refreshToken;
}

async function hash(password) {
  return await bcrypt.hash(password, 10);
}

function generateJwtToken(account) {
  return jwt.sign({ sub: account.id, id: account.id }, config.secret, { expiresIn: '15m' });
}

function generateRefreshToken(account, ipAddress) {
  return new db.RefreshToken({
    accountId: account.id,
    token: randomTokenString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress
  });
}

function randomTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {
  const { id, title, firstName, lastName, email, role, status, created, updated, isVerified } = account;
  return { id, title, firstName, lastName, email, role, status, created, updated, isVerified };
}

// ------------------------- Email helpers -------------------------

async function sendVerificationEmail(account, origin) {
  let message;
  if (origin) {
    const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
    message = `<p>Please click the below link to verify your email address:</p>
               <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
               <p><code>${account.verificationToken}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: 'Verify Email',
    html: `<h4>Verify Email</h4>
           <p>Thanks for registering!</p>
           ${message}`
  });
}

async function sendAlreadyRegisteredEmail(email, origin) {
  let message;
  if (origin) {
    message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
  } else {
    message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
  }

  await sendEmail({
    to: email,
    subject: 'Email Already Registered',
    html: `<h4>Email Already Registered</h4>
           <p>Your email <strong>${email}</strong> is already registered.</p>
           ${message}`
  });
}

async function sendPasswordResetEmail(account, origin) {
  let message;
  if (origin) {
    const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
    message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
               <p><a href="${resetUrl}">${resetUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
               <p><code>${account.resetToken}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: 'Reset Password',
    html: `<h4>Reset Password</h4>
           ${message}`
  });
}
