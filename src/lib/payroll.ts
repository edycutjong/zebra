/**
 * Zebra — Payroll and Compliance Core Logic Library
 */

export interface EmployeeRecord {
  name: string;
  id: string;
  address: string;
  salary: number;
  salt: string;
  kyc_status: string;
}

/**
 * Validates whether a string is a correctly formatted Stellar public key address.
 * Stellar public keys are 56 characters long, starting with 'G', and encoded in base32.
 */
export function validateStellarAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  // Stellar public key G-addresses regex: starts with G, followed by A-D or 2-7, and 54 characters of base32
  const stellarRegex = /^G[A-D2-7][A-Z2-7]{54}$/;
  return stellarRegex.test(address);
}

/**
 * Parses raw CSV payroll text content into a list of employee records.
 * The CSV must have headers: Name, ID, Address, Salary, Salt, KYCStatus (case-insensitive).
 */
export function parsePayrollCsv(csvContent: string): EmployeeRecord[] {
  if (!csvContent || csvContent.trim() === "") {
    throw new Error("CSV content is empty");
  }

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    throw new Error("CSV must contain a header and at least one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const idIdx = headers.indexOf("id");
  const addrIdx = headers.indexOf("address");
  const salaryIdx = headers.indexOf("salary");
  const saltIdx = headers.indexOf("salt");
  const kycIdx = headers.indexOf("kycstatus");

  if (
    nameIdx === -1 ||
    idIdx === -1 ||
    addrIdx === -1 ||
    salaryIdx === -1 ||
    saltIdx === -1 ||
    kycIdx === -1
  ) {
    throw new Error(
      "CSV headers must include Name, ID, Address, Salary, Salt, and KYCStatus",
    );
  }

  const records: EmployeeRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < headers.length) {
      throw new Error(
        `Row ${i} is incomplete: expected ${headers.length} columns, got ${cols.length}`,
      );
    }

    const name = cols[nameIdx];
    const id = cols[idIdx];
    const address = cols[addrIdx];
    const salaryStr = cols[salaryIdx];
    const salt = cols[saltIdx];
    const kyc_status = cols[kycIdx];

    if (!name) throw new Error(`Row ${i} is missing Name`);
    if (!id) throw new Error(`Row ${i} is missing ID`);
    if (!address) throw new Error(`Row ${i} is missing Address`);

    // Address validation support (we support mock short addresses in UI, but check format)
    const isMockUIAddress = address.includes("...");
    if (!isMockUIAddress && !validateStellarAddress(address)) {
      throw new Error(
        `Row ${i} contains an invalid Stellar address: ${address}`,
      );
    }

    const salary = parseFloat(salaryStr);
    if (isNaN(salary) || salary <= 0) {
      throw new Error(
        `Row ${i} contains an invalid salary amount: ${salaryStr}`,
      );
    }

    if (!salt) throw new Error(`Row ${i} is missing Salt`);
    if (!kyc_status) throw new Error(`Row ${i} is missing KYCStatus`);

    records.push({
      name,
      id,
      address,
      salary,
      salt,
      kyc_status,
    });
  }

  return records;
}

/**
 * Accumulates the total salary amount across all records.
 */
export function calculateTotalPayroll(records: EmployeeRecord[]): number {
  return records.reduce((sum, r) => sum + r.salary, 0);
}

/**
 * Checks if the treasury account has sufficient balance to execute the payroll batch.
 */
export function validateTreasuryBalance(
  totalPayroll: number,
  balance: number,
): boolean {
  return totalPayroll <= balance;
}

/**
 * Checks for duplicate employee IDs inside a payroll batch to prevent double-spending/double-payouts.
 */
export function detectDuplicateIds(records: EmployeeRecord[]): string[] {
  const ids = records.map((r) => r.id);
  const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
  return [...new Set(duplicates)];
}

/**
 * Checks for duplicate wallet addresses inside a payroll batch.
 */
export function detectDuplicateAddresses(records: EmployeeRecord[]): string[] {
  const addresses = records.map((r) => r.address);
  const duplicates = addresses.filter(
    (item, index) => addresses.indexOf(item) !== index,
  );
  return [...new Set(duplicates)];
}

/**
 * Simulates a Poseidon hashing commitment for a payroll record.
 * Generates a deterministic hash representing the private record.
 */
export function computeRecordCommitment(
  id: string,
  salary: number,
  salt: string,
): string {
  // Simple deterministic mockup of a Poseidon 3-input hash for testing
  const payload = `${id}:${salary}:${salt}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Format as a 64-character mock hex representation
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `f3ac9d8210bf${hex}000000000000000000000000000000000000000000000000`.substring(
    0,
    64,
  );
}
