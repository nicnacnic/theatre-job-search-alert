# theatre-job-search-alert
A small script that alerts users via email when a new theatre job is posted that fits their criteria. This is a script that runs in Node.JS and scans various job boards for relevant jobs. If a job is found that matches the criteria set, it will send an alert email to the recipient set in the config.

# Services Checked
The following services are checked using this script:
- OffStageJobs
- Playbill Jobs

More may be added in the future.

# Configuration
To make this script work, create a configuration file in the main folder called `config.json`. Them, add the following text:
```json
{
    "searchTerms": [],
    "maxDayRange": 5,
    "autoCheck": true,
    "emailAddress": "",
    "gmail": {
        "username": "",
        "password": ""
    }
}
```

`searchTerms`: An array of words that the script uses to find appropiate jobs. Note the script only searches job titles.  
`maxDayRange`: How far back to search for jobs for. In the default configuration, the script will search for jobs posted no more than 5 days ago.  
`autoCheck`: If set to true, the script will check job sites every 15 minutes. Turn off if using this script with a task scheduler or cron job.  
`emailAddress`: The recipient's email address.  
`gmail`: Set your username and app password for Gmail here.  

Here's an example configuration file for someone who only wants to see lighting jobs.
```json
{
    "searchTerms": [
        "lighting",
        "electrician",
        "light",
        "electrics",
        "electricians"
    ],
    "maxDayRange": 5,
    "autoCheck": true,
    "emailAddress": "test@example.com",
    "gmail": {
        "username": "test@example.com",
        "password": "myGmailAppPassword"
    }
}
```
