// Email format validation
export const isValidEmailFormat = (email) => {
  if (typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Allowed email domains
export const isAllowedDomain = (email) => {
  if (typeof email !== 'string') return false;

  const allowedDomains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'sti.edu.ph',
  ];

  const domain = email.split('@')[1]?.toLowerCase();

  return allowedDomains.includes(domain);
};

// Name validation — letters and spaces only
export const isValidName = (name) => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return false;
  }

  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(name);
};

// Password length check
export const isValidPasswordLength = (password) => {
  return typeof password === 'string' && password.length >= 6;
};

// Middle name is optional — only validate if provided
export const isValidMiddleName = (middleName) => {
  if (
    middleName == null ||
    (typeof middleName === 'string' && middleName.trim().length === 0)
  ) {
    return true;
  }

  if (typeof middleName !== 'string') return false;

  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(middleName);
};

// Check all required signup fields are filled
export const areSignupFieldsFilled = (
  firstName,
  lastName,
  email,
  password
) => {
  return (
    typeof firstName === 'string' &&
    firstName.trim().length > 0 &&
    typeof lastName === 'string' &&
    lastName.trim().length > 0 &&
    typeof email === 'string' &&
    email.trim().length > 0 &&
    typeof password === 'string' &&
    password.trim().length > 0
  );
};

// Check all required login fields are filled
export const areLoginFieldsFilled = (email, password) => {
  return (
    typeof email === 'string' &&
    email.trim().length > 0 &&
    typeof password === 'string' &&
    password.trim().length > 0
  );
};