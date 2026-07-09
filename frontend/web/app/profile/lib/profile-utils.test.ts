import { hasProfileChanges, splitPhoneNumber, type EditableProfileFields } from './profile-utils';

const baseProfile: EditableProfileFields = {
    fullName: 'Suthan Kanthan',
    firstName: 'Suthan',
    lastName: 'Kanthan',
    contactNumber: '5550000',
    countryCode: '+1',
    jobTitle: 'Product Engineer',
    company: 'Planora',
    position: 'Engineering',
    bio: 'Building useful tools.',
};

describe('profile-utils', () => {
    it('splits a full phone value into dial code and local number', () => {
        expect(splitPhoneNumber('+94771234567', '+94')).toEqual({
            countryCode: '+94',
            contactNumber: '771234567',
        });
    });

    it('detects profile changes after trimming comparable values', () => {
        expect(hasProfileChanges({ ...baseProfile, fullName: '  Suthan Kanthan  ' }, baseProfile)).toBe(false);
        expect(hasProfileChanges({ ...baseProfile, jobTitle: 'Design Lead' }, baseProfile)).toBe(true);
    });
});
