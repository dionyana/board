const fs = require('fs');
const request = require('request');

function main() {
    if (process.argv.length < 4) {
        console.log('Usage: node clinet.js GET url ');
        console.log('Usage: node client.js POST url jsonFile');
        console.log('process.argv.length : ' + process.argv.length);
        return;
    }

    const method = process.argv[2];
    const url = process.argv[3];
    const jsonFile = process.argv[4];

    switch(method) {
        case 'GET':
            request.get(url, outputServerResponse);
            break;
        case 'POST':
            if (!jsonFile) {
                console.log('JSON File is not specified');
            } else {
                postJsonFile(url, jsonFile);
            }
            break;
        default:
            console.log('Unknown method')
            break;
    }
}

main();

function outputServerResponse(err, res, body) {
    if (err) {
        console.log(err);
    } else {
        console.log('status: ' + res.statusCode);
        Object.keys(res.headers).forEach(function(name) {
            console.log(name + ': ' + res.headers[name]);
        });
        console.log('body: '+ body);
    }
}

function postJsonFile(url, jsonFile) {
    fs.readFile(jsonFile, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            options = {
                headers: {
                    'content-type' : 'application/json'
                },
                body: data
            }
            request.post(url, options, outputServerResponse);
        }
    });
}