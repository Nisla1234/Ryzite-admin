/** Password policy for administrator accounts. Returns human-readable problems, empty when valid. */
export function passwordProblems(pw: string): string[] {
  const p: string[] = [];
  if (pw.length < 12) p.push("Use at least 12 characters.");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) p.push("Mix upper and lower case letters.");
  if (!/\d/.test(pw)) p.push("Add at least one number.");
  if (!/[^A-Za-z0-9]/.test(pw)) p.push("Add at least one symbol.");
  return p;
}
