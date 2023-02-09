# LDES TS ingester

Add members to an LDES according to the LDES timestamp fragmentation explained in LDES in LDP

Configuration is the following: ... (as little as possible)

## Config

* pageSize


## Progress

* Adding a member to an LDES in mongoDB works using `@treecg/sds-storage-writer-mongo` (see `attempt-ingesting.ts`)
* create a total new LDES in mongoDB using `initialise-LDES.ts`, more specifically the `MongoDBIngestor`
* Create a TS-LDES with the `TSMongoDBIngestor`

## Next steps

* create a total new LDES in mongoDB using `@treecg/sds-storage-writer-mongo`
* Document how to create an LDES-TS using this and the Solid-LDES-Store