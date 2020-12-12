const fs = require("fs");
const got = require('got');
const tunnel = require('tunnel');

const langMap = {"chs": "zh-chs", "eng": "en"}

const langs = ["chs", "eng"]

const client = require('mongodb').MongoClient

/**
 * 
 * @param {String} url 
 * @returns {Promise<Buffer>}
 */
async function download(url) {
    return got(url, {
        agent: {
            https: tunnel.httpsOverHttp({
                proxy: {
                    host: 'localhost',
                    port: "7892"
                }
            })
        }
    });
}

async function getJson(url) {
    return await got(url, {
        agent: {
            https: tunnel.httpsOverHttp({
                proxy: {
                    host: 'localhost',
                    port: "7892"
                }
            })
        }
    }).json();
}

async function getLangManifestMap() {
    const arr = {};
    const manifest = await getJson("https://www.bungie.net/Platform/Destiny2/Manifest/");
    console.log("Downloaded Manifest");
    for (path of Object.values(manifest.Response.jsonWorldContentPaths)) {
        for (lang of langs) {
            if (path.includes(langMap[lang] + "/aggregate")) {
                arr[lang] = "https://www.bungie.net" + path;
            }
        }
    }
    return arr;
}

async function parse(db, str, lang) {
    const d2obj = JSON.parse(str.toString().replace(/BungieNet\.Engine\.Contract\.Destiny\.World\.Definitions\.IDestinyDisplayDefinition\.displayProperties/g, 'displayProperties_'));

    for (const definition in d2obj) {
        console.log(definition+"_" + lang)
        for (const id in d2obj[definition]) {
            d2obj[definition][id]["_id"] = id
            await db.collection(definition+"_" + lang).insertOne(d2obj[definition][id])
        }
    }
}

async function run() {
    const langManifestMap = await getLangManifestMap();
    
    const c = await client.connect("mongodb://localhost:27017")
    let db = c.db("destiny2")
    await db.dropDatabase(); // Drop it!
    console.log("Connected and dropped destiny2 database")
    db = c.db("destiny2")

    for (lang of langs) {
        const str = await download(langManifestMap[lang]);
        console.log("Successfully downloaded " + lang)
        parse(db, str, lang);
        console.log("Parsed " + lang + " language of manifest")
    }

    c.close()
    
}
run().catch(console.error);