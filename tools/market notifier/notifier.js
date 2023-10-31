// Notifies when a rare or crate drops

const market_webhook_url = ""
const game_webhook_url = ""
const rare_snipe_url = "https://www.brickplanet.com/shop/search?featured=0&rare=1&type=0&search=&sort_by=0&page=1"
const game_update_url = "https://www.brickplanet.com/game-api/client/get-client-version/win"

const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const axios = require('axios')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function failure(err)
{
    console.log(`request failure: ${err}`)
}

//  item_name, item_url, item_icon, item_type, price_text
function create_market_post(item)
{
    let post_info = {
        "content": "||@everyone||",
        "embeds": [
            {
                "title": `New ${item.type} available`,
                "description": `The **[${item.name}](${item.url})** are now available for sale!\nThe price is **${item.price}**`,
                "color": 16711680,
                "thumbnail": {
                    "url": `${item.icon}`
                }
            }
        ]
    }

    axios.post(market_webhook_url, post_info).catch(failure)
}

function create_update_post(name, update_data)
{
    let post_info = {
        "content": "||@everyone||",
        "embeds": [
            {
                "title": `${name} Updated`,
                "description": `${name} has updated to new **version ${update_data.version}**. You can download the new ${name} [here](${update_data.file})`,
                "color": 16711680
            }
        ]
    }

    axios.post(game_webhook_url, post_info).catch(failure)
}

async function get_items_batch()
{
    let return_value = {}
    let response = await axios.get(rare_snipe_url).catch(failure)
    const {document} = (new JSDOM(response.data)).window
    let items = document.getElementsByClassName("card position-relative h-100")

    for (let current = 0; current < items.length; current++)
    {
        let current_item = items[current]
        let image_link = current_item.getElementsByTagName("a")[0]

        let item = {
            name: current_item.getElementsByClassName("d-block truncate text-decoration-none fw-semibold text-light mb-1")[0].textContent.replace("\n", ""),
            url: image_link.href,
            icon: image_link.getElementsByTagName("img")[0].src,
            type: image_link.getElementsByClassName("badge bg-primary")[0].textContent,
            price: current_item.getElementsByClassName("text-credits")[0]
        }

        if (item.price)
            item.price = item.price.title
        else
            item.price = "No Sellers"

        return_value[item.url] = item
    }

    return return_value
}

async function get_update_info()
{
    let response = await axios.get(game_update_url).catch(failure)
    return response.data
}

async function client_notifier()
{
    console.log("Client notifier running!")
    let known_update_info = await get_update_info()

    let known_client_file = known_update_info.client.file
    let known_workshop_file = known_update_info.workshop.file
    let known_launcher_file = known_update_info.launcher.file
    let known_updater_file = known_update_info.updater.file

    while (true)
    {
        await delay(1000)
        let refreshed_info = await get_update_info()

        if (refreshed_info.client.file != known_client_file)
        {
            known_client_file = refreshed_info.client.file
            create_update_post("Client", refreshed_info.client)
        }

        if (refreshed_info.workshop.file != known_workshop_file)
        {
            known_workshop_file = refreshed_info.workshop.file
            create_update_post("Workshop", refreshed_info.workshop)
        }

        if (refreshed_info.launcher.file != known_launcher_file)
        {
            known_launcher_file = refreshed_info.launcher.file
            create_update_post("Launcher", refreshed_info.launcher)
        }

        if (refreshed_info.updater.file != known_updater_file)
        {
            known_updater_file = refreshed_info.updater.file
            create_update_post("Updater", refreshed_info.updater)
        }
    }
}

async function market_notifier()
{
    console.log("Market notifier running!")
    let known_items = await get_items_batch()
    
    while (true)
    {
        await delay(1000)
        let refreshed_items = await get_items_batch()

        for (let item_url in refreshed_items)
        {
            let current_item = refreshed_items[item_url]

            if (!known_items[item_url])
            {
                known_items[item_url] = current_item // it is now known
                create_market_post(current_item)
            }
        }
    }
}

client_notifier()
market_notifier()