import {
  isValidEmailFormat,
  isAllowedDomain,
  isValidName,
  isValidPasswordLength,
  isValidMiddleName,
  areSignupFieldsFilled,
  areLoginFieldsFilled,
} from '../../src/constants/validation';

describe('TC-U04: Input Validation', () => {

  // ─── Email Format Validation ───
  describe('Email Format Validation', () => {

    describe('Happy Path', () => {
      test('TC-U04-01: Valid Gmail address should pass', () => {
        expect(isValidEmailFormat('student@gmail.com')).toBe(true);
      });

      test('TC-U04-02: Valid STI email should pass', () => {
        expect(isValidEmailFormat('student@sti.edu.ph')).toBe(true);
      });

      test('TC-U04-03: Valid Yahoo email should pass', () => {
        expect(isValidEmailFormat('student@yahoo.com')).toBe(true);
      });
    });

    describe('Negative Scenarios', () => {
      test('TC-U04-04: Email without @ symbol should fail', () => {
        expect(isValidEmailFormat('studentgmail.com')).toBe(false);
      });

      test('TC-U04-05: Email without domain should fail', () => {
        expect(isValidEmailFormat('student@')).toBe(false);
      });

      test('TC-U04-06: Empty string should fail', () => {
        expect(isValidEmailFormat('')).toBe(false);
      });

      test('TC-U04-07: Email with spaces should fail', () => {
        expect(isValidEmailFormat('stu dent@gmail.com')).toBe(false);
      });

      test('TC-U04-08: Email without TLD should fail', () => {
        expect(isValidEmailFormat('student@gmail')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      test('TC-U04-09: Email with multiple @ symbols should fail', () => {
        expect(isValidEmailFormat('stu@dent@gmail.com')).toBe(false);
      });

      test('TC-U04-10: Email with subdomain should pass', () => {
        expect(isValidEmailFormat('student@mail.sti.edu.ph')).toBe(true);
      });
    });
  });

  // ─── Allowed Domain Validation ───
  describe('Allowed Email Domain Validation', () => {

    describe('Happy Path', () => {
      test('TC-U04-11: gmail.com should be allowed', () => {
        expect(isAllowedDomain('student@gmail.com')).toBe(true);
      });

      test('TC-U04-12: yahoo.com should be allowed', () => {
        expect(isAllowedDomain('student@yahoo.com')).toBe(true);
      });

      test('TC-U04-13: outlook.com should be allowed', () => {
        expect(isAllowedDomain('student@outlook.com')).toBe(true);
      });

      test('TC-U04-14: sti.edu.ph should be allowed', () => {
        expect(isAllowedDomain('student@sti.edu.ph')).toBe(true);
      });
    });

    describe('Negative Scenarios', () => {
      test('TC-U04-15: hotmail.com should not be allowed', () => {
        expect(isAllowedDomain('student@hotmail.com')).toBe(false);
      });

      test('TC-U04-16: icloud.com should not be allowed', () => {
        expect(isAllowedDomain('student@icloud.com')).toBe(false);
      });

      test('TC-U04-17: Random domain should not be allowed', () => {
        expect(isAllowedDomain('student@random.com')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      test('TC-U04-18: Domain in uppercase should still be allowed', () => {
        expect(isAllowedDomain('student@GMAIL.COM')).toBe(true);
      });

      test('TC-U04-19: Domain in mixed case should still be allowed', () => {
        expect(isAllowedDomain('student@Gmail.Com')).toBe(true);
      });
    });
  });

  // ─── Name Validation ───
  describe('Name Validation', () => {

    describe('Happy Path', () => {
      test('TC-U04-20: Valid first name with letters only should pass', () => {
        expect(isValidName('Kyle')).toBe(true);
      });

      test('TC-U04-21: Valid name with space should pass', () => {
        expect(isValidName('Juan Carlos')).toBe(true);
      });

      test('TC-U04-22: Valid name with lowercase should pass', () => {
        expect(isValidName('john')).toBe(true);
      });
    });

    describe('Negative Scenarios', () => {
      test('TC-U04-23: Name with numbers should fail', () => {
        expect(isValidName('Kyle123')).toBe(false);
      });

      test('TC-U04-24: Name with special characters should fail', () => {
        expect(isValidName('Kyle@Aundry')).toBe(false);
      });

      test('TC-U04-25: Empty name should fail', () => {
        expect(isValidName('')).toBe(false);
      });

      test('TC-U04-26: Name with only spaces should fail', () => {
        expect(isValidName('   ')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      test('TC-U04-27: Single letter name should pass', () => {
        expect(isValidName('A')).toBe(true);
      });

      test('TC-U04-28: Null name should fail', () => {
        expect(isValidName(null)).toBe(false);
      });
    });
  });

  // ─── Middle Name Validation ───
  describe('Middle Name Validation (Optional Field)', () => {

    describe('Happy Path', () => {
      test('TC-U04-29: Empty middle name should pass (optional)', () => {
        expect(isValidMiddleName('')).toBe(true);
      });

      test('TC-U04-30: Null middle name should pass (optional)', () => {
        expect(isValidMiddleName(null)).toBe(true);
      });

      test('TC-U04-31: Valid middle name should pass', () => {
        expect(isValidMiddleName('Santos')).toBe(true);
      });
    });

    describe('Negative Scenarios', () => {
      test('TC-U04-32: Middle name with numbers should fail', () => {
        expect(isValidMiddleName('Santos123')).toBe(false);
      });

      test('TC-U04-33: Middle name with special characters should fail', () => {
        expect(isValidMiddleName('Santos!')).toBe(false);
      });
    });
  });

  // ─── Password Validation ───
  describe('Password Length Validation', () => {

    describe('Happy Path', () => {
      test('TC-U04-34: Password with exactly 6 characters should pass', () => {
        expect(isValidPasswordLength('abc123')).toBe(true);
      });

      test('TC-U04-35: Password longer than 6 characters should pass', () => {
        expect(isValidPasswordLength('securepassword123')).toBe(true);
      });
    });

    describe('Negative Scenarios', () => {
      test('TC-U04-36: Password shorter than 6 characters should fail', () => {
        expect(isValidPasswordLength('abc')).toBe(false);
      });

      test('TC-U04-37: Empty password should fail', () => {
        expect(isValidPasswordLength('')).toBe(false);
      });

      test('TC-U04-38: Null password should fail', () => {
        expect(isValidPasswordLength(null)).toBe(false);
      });
    });

    describe('Boundary Testing', () => {
      test('TC-U04-B01: Password with exactly 5 characters should fail (below boundary)', () => {
        expect(isValidPasswordLength('abcde')).toBe(false);
      });

      test('TC-U04-B02: Password with exactly 6 characters should pass (at boundary)', () => {
        expect(isValidPasswordLength('abcdef')).toBe(true);
      });

      test('TC-U04-B03: Password with exactly 7 characters should pass (above boundary)', () => {
        expect(isValidPasswordLength('abcdefg')).toBe(true);
      });
    });
  });

  // ─── Required Fields Validation ───
  describe('Required Fields Validation', () => {

    describe('Signup Fields', () => {
      test('TC-U04-39: All filled signup fields should pass', () => {
        expect(areSignupFieldsFilled('Kyle', 'Aundry', 'kyle@gmail.com', 'password123')).toBe(true);
      });

      test('TC-U04-40: Missing first name should fail', () => {
        expect(areSignupFieldsFilled('', 'Aundry', 'kyle@gmail.com', 'password123')).toBe(false);
      });

      test('TC-U04-41: Missing last name should fail', () => {
        expect(areSignupFieldsFilled('Kyle', '', 'kyle@gmail.com', 'password123')).toBe(false);
      });

      test('TC-U04-42: Missing email should fail', () => {
        expect(areSignupFieldsFilled('Kyle', 'Aundry', '', 'password123')).toBe(false);
      });

      test('TC-U04-43: Missing password should fail', () => {
        expect(areSignupFieldsFilled('Kyle', 'Aundry', 'kyle@gmail.com', '')).toBe(false);
      });

      test('TC-U04-44: All fields with only spaces should fail', () => {
        expect(areSignupFieldsFilled('   ', '   ', '   ', '   ')).toBe(false);
      });
    });

    describe('Login Fields', () => {
      test('TC-U04-45: All filled login fields should pass', () => {
        expect(areLoginFieldsFilled('kyle@gmail.com', 'password123')).toBe(true);
      });

      test('TC-U04-46: Missing email should fail', () => {
        expect(areLoginFieldsFilled('', 'password123')).toBe(false);
      });

      test('TC-U04-47: Missing password should fail', () => {
        expect(areLoginFieldsFilled('kyle@gmail.com', '')).toBe(false);
      });

      test('TC-U04-48: Both fields empty should fail', () => {
        expect(areLoginFieldsFilled('', '')).toBe(false);
      });
    });
  });
});