const { By, Builder, until, error } = require("selenium-webdriver")
const { Options } = require("selenium-webdriver/chrome")
const crypto = require("crypto")
const axios = require('axios')
const { JSDOM } = require("jsdom")

// Item to buy with both bits and credits
let buy_item_id = "14514"

async function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Buy the item VIA axios, it's WAY faster
async function buy_item(item_id, cookie)
{
    let page_data = await axios.get(`https://www.brickplanet.com/shop/${item_id}/`, {
        headers: {
            'cookie': cookie
        }
    })

    let {document} = (new JSDOM(page_data.data)).window
    let inputs = document.getElementsByTagName('input')
    let _token = null

    for (let i = 0; i < inputs.length; ++i)
    {
        if (inputs[i].name == '_token')
        {
            _token = inputs[i].value
            break
        }
    }

    if (_token == null)
    {
        console.log("failed to find buy token")
        return
    }

    // buy with credits
    await axios.post(`https://www.brickplanet.com/shop/${item_id}/buy-item`, {
        '_token': _token,
        'currency': '1',
        'quantity': '1'
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'cookie': cookie
        }
    })

    // delete
    sleep(1000)
    await axios.post(`https://www.brickplanet.com/shop/${item_id}/remove-item-backpack`, {
        '_token': _token
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'cookie': cookie
        }
    })

    // buy with bits
    sleep(1000)
    await axios.post(`https://www.brickplanet.com/shop/${item_id}/buy-item`, {
        '_token': _token,
        'currency': '2',
        'quantity': '1'
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'cookie': cookie
        }
    })

    // delete
    sleep(1000)
    await axios.post(`https://www.brickplanet.com/shop/${item_id}/remove-item-backpack`, {
        '_token': _token
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'cookie': cookie
        }
    })
}

async function make_an_account(password)
{
    // Bypass cloudflare
    const options = new Options()
    .setChromeBinaryPath(String.raw`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`)
    .addArguments("incognito", "start-maximized")
    .addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36")
    .addArguments("disable-blink-features=AutomationControlled")
    .addArguments("remote-debugging-port=9222")
    
    //.headless()

    // Create webdriver
    let driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

    await driver.manage().setTimeouts({implicit: 3000})

    // Load and retrieve an email
    await driver.get('https://www.tempmailo.com/')
    await driver.wait(async () => (await driver.getTitle()) === "Temp Mail - Temporary Disposable Email Address")
    let tempmail_window = await driver.getWindowHandle()
    let tempMailEmailBox = await driver.findElement(By.id("i-email"))

    await driver.wait(async () => {
        let current_value = await tempMailEmailBox.getAttribute("value")
        return current_value !== ""
    })
    let email = await tempMailEmailBox.getAttribute("value")
    console.log(`generated email: ${email}`)

    await driver.switchTo().newWindow('window')
    await driver.get('https://www.brickplanet.com/register')
    let brickplanet_window = await driver.getWindowHandle()

    let usernameBox = await driver.findElement(By.id("username"))
    let passwordBox = await driver.findElement(By.name("password"))
    let confirmPasswordBox = await driver.findElement(By.name("password_confirmation"))
    let emailBox = await driver.findElement(By.id("email"))
    let birthdayBox = await driver.findElement(By.name("date_of_birth"))
    let agreeTermsBox = await driver.findElement(By.id("confirm"))
    let captchaFrame = await driver.findElement(By.css(".h-captcha>iframe"))
    let createAccountButton = await driver.findElement(By.css(".mb-3>button"))

    // switch to captcha frame
    await driver.switchTo().frame(captchaFrame)
    let captchaCheckMark = await driver.findElement(By.id("checkbox"))

    // wait for captcha solve
    await driver.wait(async () => (await captchaCheckMark.getAttribute("aria-checked")) === "true")

    // switch to main frame
    await driver.switchTo().defaultContent()

    let username = crypto.randomBytes(10).toString('hex')

    await usernameBox.sendKeys(username)
    await passwordBox.sendKeys(password)
    await confirmPasswordBox.sendKeys(password)
    await emailBox.sendKeys(email)
    await birthdayBox.clear()
    await birthdayBox.sendKeys("01011999")
    await agreeTermsBox.click()
    await createAccountButton.click()

    // wait until confirm email screen
    await driver.wait(async () => (await driver.getTitle()) === "Verify Your Account | BrickPlanet")

    console.log("Successfully created an account! Verifying...")
    console.log(`Account information: ${username}:${password}`)

    await driver.switchTo().window(tempmail_window)
    let inboxSenderElement = null

    // Wait for email
    await driver.wait(async() => {
        try
        {
            let found = await driver.findElement(By.css('.mail-item>.title'))
            let text = await found.getText()
            if ((text.startsWith('"BrickPlanet"')))
                inboxSenderElement = found
        }
        catch (err)
        {
            if (!(err instanceof error.NoSuchElementError))
            {
                console.log(`Received unexpected error\nerror: ${err}`)
            }
        }

        return inboxSenderElement != null
    })

    // click to open mail
    await inboxSenderElement.click()
    let embedded_frame = await driver.findElement(By.id('fullmessage'))

    // open embedded frame
    await driver.switchTo().frame(embedded_frame)

    // cloudflare is good at detecting if the redirects are from a bot, might as well manually click as u will have a way higher success chance (otherwise u get blocked and have to restart everything)
    let brickPlanetConfirmEmailLink = null

    await driver.wait(async() => {
        try
        {
            brickPlanetConfirmEmailLink = await (await driver.findElement(By.css(`p>span>a`))).getText()
        }
        catch (err)
        {
            if (!(err instanceof error.NoSuchElementError))
            {
                console.log(`Received unexpected error\nerror: ${err}`)
            }
        }

        return brickPlanetConfirmEmailLink != null
    })

    await driver.switchTo().window(brickplanet_window)
    await driver.get(brickPlanetConfirmEmailLink)
    let credits_amount = await driver.findElement(By.css(".nav-link.text-credits")).getText()
    let bits_amount = await driver.findElement(By.css(".nav-link.text-warning")).getText()

    console.log(`Successfully created ${credits_amount} credits & ${bits_amount} bits.`)
    console.log("Transferring...")

    let cookie_string = ""
    let cookies = await driver.manage().getCookies()
    for (let i = 0; i < cookies.length; ++i)
    {
        let current_cookie = cookies[i]
        cookie_string += current_cookie.name + "=" + current_cookie.value + ";"
    }

    await buy_item(buy_item_id, cookie_string)
    await driver.quit()
    console.log("Finished transferring cash! Check your account ;)")
}


console.log("running account creator written by birdy! enjoy the fast fat fucking cash!")
make_an_account(crypto.randomBytes(10).toString('hex'))