import { describe, it, expect } from 'vitest';
import { recipientsForOwner } from '@/lib/documents';

/**
 * Mirrors the real roster shape: a document folder is keyed by investor
 * (permissions.lpName), so several logins can share one folder. The live
 * data has two such cases — Ayman Ismail (3 logins, 3 addresses) and
 * Ambrish Mody (2 logins, one of which has no email).
 */
const lp = (username, lpName, email, name) => ({
  username, name: name || username, email,
  permissions: lpName ? { lpName } : {},
});

const USERS = [
  lp('Ayman.Ismail', 'Ayman Ismail', 'ayman@corp-aic.com', 'Ayman Ismail'),
  lp('Mohamed.Noufal', 'Ayman Ismail', 'mohamed@dmc-curve.com', 'Mohamed Noufal'),
  lp('Karim.Soliman', 'Ayman Ismail', 'karim@icloud.com', 'Karim Soliman'),
  lp('ambrishmody', 'Ambrish Mody', 'ambrish@gmail.com', 'Ambrish Mody'),
  lp('Ayman.Test', 'Ambrish Mody', '', 'Test Account'),
  lp('mariokarras', 'Mario Karras', 'mario@example.com', 'Mario Karras'),
  lp('halakarras', 'Hala Karras', 'HALA@Example.com', 'Hala Karras'),
  lp('dupe', 'Hala Karras', 'hala@example.com', 'Hala Dup'),
  lp('andrew', null, '', 'Andrew Maher'),
];

const emailsFor = (username) =>
  recipientsForOwner(USERS, USERS.find(u => u.username === username)).map(r => r.email);

describe('recipientsForOwner', () => {
  it('notifies every login that shares the investor folder', () => {
    // The point of the change: uploading against any ONE of Ayman's logins
    // must still reach all three people who can see the document.
    expect(emailsFor('Ayman.Ismail').sort()).toEqual(
      ['ayman@corp-aic.com', 'karim@icloud.com', 'mohamed@dmc-curve.com'],
    );
    expect(emailsFor('Karim.Soliman').sort()).toEqual(
      ['ayman@corp-aic.com', 'karim@icloud.com', 'mohamed@dmc-curve.com'],
    );
  });

  it('drops accounts with no email rather than failing', () => {
    expect(emailsFor('ambrishmody')).toEqual(['ambrish@gmail.com']);
    expect(emailsFor('Ayman.Test')).toEqual(['ambrish@gmail.com']);
  });

  it('sends one message per person when two logins share an address', () => {
    expect(emailsFor('halakarras')).toEqual(['HALA@Example.com']);
  });

  it('falls back to the username as folder key when no LP is mapped', () => {
    expect(emailsFor('andrew')).toEqual([]);
  });

  it('keeps unrelated LPs out', () => {
    expect(emailsFor('mariokarras')).toEqual(['mario@example.com']);
  });

  it('is safe with missing inputs', () => {
    expect(recipientsForOwner([], { username: 'x' })).toEqual([]);
    expect(recipientsForOwner(null, { username: 'x' })).toEqual([]);
    expect(recipientsForOwner(USERS, {})).toEqual([]);
    expect(recipientsForOwner(USERS, null)).toEqual([]);
  });

  it('returns a name for the greeting, falling back to the username', () => {
    const r = recipientsForOwner(USERS, USERS.find(u => u.username === 'mariokarras'));
    expect(r[0]).toMatchObject({ name: 'Mario Karras', username: 'mariokarras' });
  });
});
