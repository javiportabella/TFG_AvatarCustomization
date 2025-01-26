// Follow this tutorial: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart
const SUBDOMAIN = 'oasisme'; // your project name
const API_ID = '678787338a474ff75326a320';
let TOKEN = null;

async function init() {

    // Create an anonymous user and obtain the access token required to access the API endpoints
    const data = await createAnonymousUser();

    if(data) {
        // Get access token from the response
        TOKEN = data.data.token;

        // Get list of assets
        const assets = await getAllAssets();

        if(assets) {
            const list = assets.data;
            // Show response at console log
            console.log(list);
            // Show response at web
            document.getElementById("response").innerText = JSON.stringify(list, undefined, 2);
        }
    }
}

// Create an anonymous user for your application to get a token
async function createAnonymousUser() { // Documentation: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart#create-anonymous-user
    const response = await fetch('https://'+ SUBDOMAIN + '.readyplayer.me/api/users', {method: "POST"});
    try {
        if(response.ok) {
            return await response.json();

        }
        else {
            console.error(response.status + ": " + response.statusText);
        }
    }
    catch(error) {
        console.error(error);
    }
    return null;
}

// Get all available assets
async function getAllAssets() { // Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/assets/get-list-assets
    const response = await fetch('https://api.readyplayer.me/v1/assets', {method: "GET", headers: {"X-APP-ID": API_ID, "Authorization": 'Bearer '+ TOKEN}});
    try {
        if(response.ok) {
            return await response.json();
        }
        else {
            console.error(response.status + ": " + response.statusText);
        }
    }
    catch(error) {
        console.error(error);
    }
    return null;
}

init();
