# LDES TS ingester

Add members to an LDES according to the LDES timestamp fragmentation explained in LDES in LDP

Configuration is the following: ... (as little as possible)

## Config

* pageSize


## Progress

* Adding a member to an LDES in mongoDB works using `@treecg/sds-storage-writer-mongo` (see `attempt-ingesting.ts`)
* create a total new LDES in mongoDB using `initialise-LDES.ts`, more specifically the `MongoDBIngestor`
* Half create a TS-LDES with the `TSMongoDBIngestor`
  * needs some proper checks to make sure everything works as intended

## Next steps

* finish TODOs so that publishing members in `TSMongoDBIngestor` works as intended
  * correct start and end fields for the windows in `index`
  * don't create a new TS when it already exists
  * proper initialisation
    * pageSize
    * SDS metadata
    * timestampPath
    * start timestamp of LDES
* create a total new LDES in mongoDB using `@treecg/sds-storage-writer-mongo`