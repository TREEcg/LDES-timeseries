// generate SDS metadata

import { extractMembers, N3Support, RDF, turtleStringToStore } from '@treecg/ldes-snapshot';
import { RelationType, SDS } from '@treecg/types';
import { readFileSync } from 'fs';
import { storeFromFile } from './src/Util';
import { MongoDBIngestor } from './src/MongoDBIngestor'
/**
 * See https://treecg.github.io/SmartDataStreams-Spec/#sds-description%E2%91%A0 for more information
 */
interface ISDSDescription extends N3Support {
    sdsIdentifier: string;
    carries: string; // Information about the current dataset containing information about license etc.
    dataset: IDCATDataSet; // Information about the what record is being carried. (e.g. sds:Member)
    shape?: string  // Optional: specifies the shape of records on this stream.
}

interface IDCATDataSet extends N3Support {
    title: string; // `dct:string` | range is a string
    publisher: string; // `dct:publisher` | range includes: `http://purl.org/dc/terms/Agent`; so must be an URL?
    timestampPath: string; // `ldes:timestampPath` | So actually a shacl path
    identifier: string; // `dct:identifier` | TODO: what does this represent -> the actual location of the LDES?
}

// generate metadata for ingest to work with buckets

// TODO: find out how to make the root view
// Root view is done through bucket ""


// TODO: What I want in the end is an LDES-TS store


async function main() {
    // TODO: add logging to Ingestor

    // load example sds configuration
    const sdsMetadataString = readFileSync('sds-metadata.ttl', 'utf-8');
    const sdsMetadataStore = await turtleStringToStore(sdsMetadataString);
    const sdsIdentifier = sdsMetadataStore.getSubjects(RDF.type, SDS.Stream, null)[0].value;

    // load some members
    const fileName = "location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"
    const store = await storeFromFile(fileName);
    const members = extractMembers(store, ldesIdentifier);

    // initialise mongoDB ingestor
    const ingestor = new MongoDBIngestor({ sdsStreamIdentifier: sdsIdentifier });

    await ingestor.initialise(sdsMetadataString);

    const rootBucket = ""
    const bucketName = "fragmentation"
    // create a bucket
    await ingestor.createBucket(rootBucket);
    await ingestor.createBucket(bucketName); // Note: Currently an unsafe method: can create same bucket multiple times
    console.log("bucket created");

    // create a member
    await ingestor.storeMembers(members); // Note: currently an unsafe method: can store member multiple times
    console.log("member added");

    // add a member to a bucket
    await ingestor.addMemberstoBucket(rootBucket, members.map(member => member.id.value)) // Note: currently an unsafe method: can add member multiple times to a given fragment
    await ingestor.addMemberstoBucket(bucketName, members.map(member => member.id.value))
    console.log("add member to bucket");

    // add relation to first relation
    await ingestor.addRelationsToBucket(rootBucket,[{
        type: RelationType.GreaterThanOrEqualTo,
        value: new Date().toISOString(),
        bucket: bucketName,
        path: "http://www.w3.org/ns/sosa/resultTime"
    }]);
    console.log("Add a relation from "+ rootBucket + " to " + bucketName);

    // TODO: configure LDES store to work with the newly created LDES.
    // changed config to work with my database
    // $ npx @treecg/actor-init-ldes-client http://localhost:3000/ldes/example --disableSynchronization true
    // Note: no default tree view is defined in the document -> must be added

    // TODO: Create LDES in LDP like logic/bucketize -> Look at publisher interface or event sourcing in general.

    await ingestor.exit();
}
main();

