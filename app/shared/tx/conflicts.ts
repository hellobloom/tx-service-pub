// Conflics enumerates contract tx sequences that must be performed concurrently in order to succeed
// All conflicts are valid sequences. They just have an ordering constraint
//
// Invalid sequences are not enumerated because they do not lead to both transactions succeeding
// Example: 2 create account transactions, or 2 addAddressToAccount transactions referencing the same address
// The 2nd transaction should rightfully fail. It should be caught prior to attempting the invalid transaction sequence
export const TxConflicts = {
  AccountRegistryLogic: {
    linkAddresses: [
      // Conflict if newAddress is not yet removed from a previous BloomID
      // Probability medium
      {
        contract: 'AccountRegistryLogic',
        method: 'unlinkAddress',
        fields: [
          {
            local: '_newAddress',
            remote: '_addressToRemove',
          },
        ],
      },
    ],
    unlinkAddress: [
      // Conflict if addressToRemove account linking is not done yet
      // Probability: high
      {
        contract: 'AccountRegistryLogic',
        method: 'linkAddresses',
        fields: [
          {
            local: '_addressToRemove',
            remote: '_newAddress',
          },
        ],
      },
      {
        contract: 'AccountRegistryLogic',
        method: 'linkAddresses',
        fields: [
          {
            local: '_addressToRemove',
            remote: '_currentAddress',
          },
        ],
      },
    ],
  },
}
