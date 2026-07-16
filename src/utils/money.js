export function createUniquePaymentCode() {
  return Math.floor(Math.random() * 900) + 100;
}

export function calculateTotalAmount(baseAmount, uniqueCode) {
  return Number(baseAmount) + Number(uniqueCode);
}
