# NameRegistrar Design Assumptions & Criteria:


The implementation is designed according to the following premises and criteria as previously discussed:

The `NameRegistrar` is a contract that allows users to claim an alias that will be associated to their account. 

0) The alias won't be transferable & it can only be set once.
1) The name generation has no cost.
2) Works as decentralized as possible. It won't rely on external factors (such as private mempools) as sources of security.
3) Uses a registry flow base in the commit-reveal+consumeCommitment steps.
4) Has fixed and constant commitment times in order to consume a commitment.
5) Protects users against frontrunning attacks that may try to steal others aliases.
6) The cost of the registration process is subsidized by the chain.

