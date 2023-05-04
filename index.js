const LocalStorage = require('node-localstorage').LocalStorage;
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const url = require('url');
const config = require('./config.json');
localStorage = new LocalStorage('./');
let maxDate = new Date();

if (!localStorage.getItem('lastPlaybillJobSearched')) {
    localStorage.setItem('lastPlaybillJobSearched', '')
}
if (!localStorage.getItem('lastOffstageJobSearched')) {
    localStorage.setItem('lastOffstageJobSearched', '')
}

if (!localStorage.getItem('lastSearchTime')) {
    localStorage.setItem('lastSearchTime', '')
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.gmail.username,
        pass: config.gmail.password
    }
});

launch();
async function launch() {
    getJobs();
    if (config.autoCheck) setInterval(getJobs, 900000)
}

async function getJobs() {
    maxDate = maxDate - (86400000 * config.maxDayRange);
    let playbillJobList = await evalPlaybillJobs();
    let offstageJobList = await evalOffstageJobs();
    sendEmails(playbillJobList, offstageJobList);
    let date = new Date();
    localStorage.setItem('lastSearchTime', date.toString());
}

async function evalPlaybillJobs() {
    return new Promise(async (funcResolve) => {
        let jobEmailContent = [];
        const playbillPage = await (await fetch('https://playbill.com/jobs?q=&category=&state=&paid=&union=&intern=#')).text();
        const playbillParse = parse(playbillPage);
        const playbillJobs = playbillParse.querySelectorAll('.bsp-component-content > .pb-tile-wrapper a')
        const lastPlaybillJobSearched = localStorage.getItem('lastPlaybillJobSearched');

        let promise = new Promise(async (resolve) => {
            for (let i = 0; i < playbillJobs.length; i++) {
                let jobDate = new Date(playbillJobs[i].querySelector('.pb-tile-post-date').innerHTML);
                if (jobDate < maxDate) { resolve(); break; }
                let jobURL = url.parse(playbillJobs[i].getAttribute('href'), true);
                let splitString = jobURL.pathname.split('/');
                if (splitString[3] === lastPlaybillJobSearched) { resolve(); break; }
                let jobTitle = (playbillJobs[i].querySelector('.pb-tile-title').innerHTML).toLowerCase();
                if (config.searchTerms.some(v => jobTitle.includes(v))) jobEmailContent.push(await playbillJobDetails(playbillJobs[i].getAttribute('href')));
                if (i >= playbillJobs.length - 1) { resolve(); break; }
            }
        })

        await Promise.all([promise]);
        let lastJobUrl = (url.parse(playbillJobs[0].getAttribute('href'), true)).pathname.split('/')[3];
        localStorage.setItem('lastPlaybillJobSearched', lastJobUrl)
        funcResolve(jobEmailContent);
    })
}

async function evalOffstageJobs() {
    return new Promise(async (funcResolve) => {
        let jobEmailContent = [];
        const offstagePage = await (await fetch('https://staging.offstagejobs.com/jobs.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'selectRegionID=&selectDeptID=&selectJobClassID=&sortQueryID=1&postedDate=01-01-1990&page=-1&query_check=Search'
        })).text();
        const offstageParse = parse(offstagePage);
        const offstageJobs = offstageParse.querySelectorAll('#Content > tr')
        const lastOffstageJobSearched = localStorage.getItem('lastOffstageJobSearched');


        let promise = new Promise(async (resolve) => {
            for (let i = 1; i < offstageJobs.length; i++) {
                let jobDate = new Date((offstageJobs[i].querySelector('.itemPosted').innerHTML).split('Posted:&nbsp;')[1].split(' ')[0]);
                if (jobDate < maxDate) { resolve(); break; }
                let jobURL = url.parse(offstageJobs[i].querySelector('.itemPosted a').getAttribute('href'), true);
                if (jobURL.query.jobID === lastOffstageJobSearched) { resolve(); break; }
                let jobTitle = (offstageJobs[i].querySelector('.itemh1 a').innerHTML).toLowerCase();
                if (config.searchTerms.some(v => jobTitle.includes(v))) jobEmailContent.push(await offstageJobDetails(offstageJobs[i].querySelector('.itemPosted a').getAttribute('href')));
                if (i >= offstageJobs.length - 1) { resolve(); break; }
            }
        })

        await Promise.all([promise]);
        let lastJobUrl = url.parse(offstageJobs[1].querySelector('.itemPosted a').getAttribute('href'), true);
        localStorage.setItem('lastOffstageJobSearched', lastJobUrl.query.jobID)
        funcResolve(jobEmailContent);
    })
}

async function playbillJobDetails(url) {
    return new Promise(async (resolve) => {
        let jobDetails = await (await fetch(url)).text();
        let jobParse = parse(jobDetails);
        let section = jobParse.querySelectorAll('.jobs-section');
        let jobInfo = section[0].querySelector('p').innerHTML.split('<br>');
        let jobContactInfo;
        try { jobContactInfo = section[0].querySelector('h4 + p').innerHTML; } catch { jobContactInfo = '' };
        let jobDescription = section[1];
        jobDescription.querySelector('.jobs-section-header').remove();
        let details = {
            title: jobParse.querySelector('.jobs-page-title').innerHTML,
            company: jobInfo[0],
            city: jobInfo[1],
            country: jobInfo[2],
            description: jobDescription,
            contactEmail: 'Visit job posting to get email address.',
            website: '',
            url: url,
        }
        resolve(details);
    })
}

async function offstageJobDetails(url) {
    return new Promise(async (resolve) => {
        let jobDetails = await (await fetch(url)).text();
        let jobParse = parse(jobDetails);
        let jobInfo = jobParse.querySelectorAll('.itemVenue p');
        let jobDescription = jobParse.querySelector('.itemDescr p');
        jobDescription.querySelector('form').remove();
        let details = {
            title: jobParse.querySelector('.itemh1 a').innerHTML,
            company: jobParse.querySelector('.itemh2').innerHTML.replace(/\n/g, '').replace(/\t/g, '').replace(/\r/g, ''),
            city: jobInfo[2].innerHTML.split('  ')[0],
            country: 'Unknown',
            description: jobDescription.innerHTML.replace(/\n/g, '').replace(/\t/g, '').replace(/\r/g, '').replace('+ndash;', '-'),
            contactEmail: jobParse.querySelector('.emu').innerHTML.replace('(at)', '@').replace('(dot)', "."),
            website: jobParse.querySelector('.itemContact h4 a').innerHTML,
            url: url,
        }
        resolve(details);
    })
}

async function sendEmails(playbill, offstage) {
    let numJobs = playbill.length + offstage.length;
    if (numJobs <= 0) return;
    let emailHTML = `
    <!DOCTYPE html>
    <html>
    <body>
    <p style="font-size:14px">
    Hi there!<br><br>Since we last checked, ${numJobs} new job${(numJobs === 1) ? ' was' : 's were'} posted on the online job forums that we follow. Here's what's new!<br>
    `
    let jobHTML = '';
    for (let job of playbill) {
        jobHTML += `<p style="font-size: 20px"><b>${job.title}</b></p>
        <p style="font-size: 14px"><b>Company: </b>${job.company}<br><b>Company Website: </b>${job.website}<br><b>City: </b>${job.city}<br><b>Country: </b>${job.country}<br>
        <b>Contact Email: </b>${job.contactEmail}<br><b>Job Link: </b><a href="${job.url}" target="_blank">${job.url}</a><br><b>Job Description: </b><br>${job.description}<br><br></p>`
    }

    for (let job of offstage) {
        jobHTML += `<p style="font-size: 20px"><b>${job.title}</b></p>
        <p style="font-size: 14px"><b>Company: </b>${job.company}<br><b>Company Website: </b>${job.website}<br><b>City: </b>${job.city}<br><b>Country: </b>${job.country}<br>
        <b>Contact Email: </b>${job.contactEmail}<br><b>Job Link: </b><a href="${job.url}" target="_blank">${job.url}</a><br><b>Job Description: </b><br>${job.description}<br><br></p>`
    }

    emailHTML += jobHTML;
    emailHTML += `
    </body>
        <style>
            body {
                width: 60%;
                height: 100%;
                overflow-x: hidden;
                text-wrap: wrap;
            }
        </style>
    </html>`

    let mailOptions = {
        from: config.emailAddress,
        to: config.emailAddress,
        subject: 'New Jobs Have Been Posted!',
        html: emailHTML
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.error(error);
        } else {
            let date = new Date();
            console.log('Email sent on ' + date.toString() + '.')
        }
    });
}