/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// [START drive_quickstart]
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {uploadS3} = require('./aws-s3')
const util = require('util');

const SCOPES = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/gmail.send'];

const SECRET_FOLDER = '/secrets/';
const APK_FOLDER = '/apk/';


const rootFolderId=process.env.GDRIVE_ROOT_FOLDER_ID

const CREDENTIALS_PATH = SECRET_FOLDER + 'credentials.json';
const TOKEN_PATH = SECRET_FOLDER + 'token.json';
const OUTPUT_PATH = APK_FOLDER + 'output.json';
const CHANGELOG_PATH = APK_FOLDER + 'changelog';
const REVISION_PATH = APK_FOLDER + 'revision';


process.on('unhandledRejection', up => { throw up });

(async function(){
  
  const readFileAsync = util.promisify(fs.readFile)
  console.log(CREDENTIALS_PATH)
  const credentials= JSON.parse(await readFileAsync(CREDENTIALS_PATH))
  const oAuth2Client = new google.auth.OAuth2(credentials.installed.client_id, credentials.installed.client_secret, credentials.installed.redirect_uris[0]);    
  if (process.argv[2]=='gen'){
    const newToken = await getNewAccessToken(oAuth2Client)
    console.log(JSON.stringify(newToken))
    return;
  }
  const token = JSON.parse(await readFileAsync(TOKEN_PATH))  
  oAuth2Client.setCredentials(token);
  
  const outputInfo=JSON.parse(await readFileAsync(OUTPUT_PATH))[0]  
  const revision = await readFileAsync(REVISION_PATH)
  const changeLog = await readFileAsync(CHANGELOG_PATH);
  const apkLocation = APK_FOLDER + outputInfo.path;  

  var apkData;
  if(outputInfo.apkData){
    apkData = outputInfo.apkData;
  } else {
    apkData = outputInfo.apkInfo;
  }
  const uniqueVersionInfo = apkData.versionName + '('+ apkData.versionCode.toString() + ')-SC(' + revision+')';



  const variantFolderId= await getVariantFolderId(oAuth2Client,rootFolderId);  
  /*const fileNameToUse =  apkData.fullName + '-'+ uniqueVersionInfo + '.apk'
  const fileId = await uploadFileAsync(oAuth2Client,apkLocation,fileNameToUse,changeLog.toString(), variantFolderId)
  const s3File = await uploadS3(process.env.PROJECT_NAME,process.env.VARIANT_NAME,fileNameToUse,apkLocation)
  await shareFile(oAuth2Client,fileId)
  var emailParams = getEmailParameters(fileId, variantFolderId,changeLog, uniqueVersionInfo,s3File);
  var result =  await sendEmail(oAuth2Client,emailParams)
  console.log(result)*/
})();
return;


function getEmailParameters(fileId,variantFolderId, changeLog,uniqueVersionInfo,s3FileURL) {
  const shareLink = 'https://drive.google.com/open?id=' + fileId; 
  const previousVersionsLink = 'https://drive.google.com/drive/u/1/folders/' + variantFolderId
  const body = '\n\n' +'DOWNLOAD APP FROM:' + '\n' + shareLink + '\n' + s3FileURL + '\n\n' + 'CHANGES IN THIS RELEASE:' + '\n' + changeLog + '\n\n' + 'PREVIOUS APP VERSIONS:' + '\n' + previousVersionsLink + '\n\n';
  const htmlBody = body.split('\n').join('\n<br>\n');
  const emailParams = {
    fromName: 'TDS CI',
    fromAddress: process.env.FROM_ADDRESS,
    to: process.env.TO_ADDRESSES,
    subject: process.env.PROJECT_NAME + '  -  ' + process.env.VARIANT_NAME + '  -  ' + uniqueVersionInfo,
    body: htmlBody
  };
  return emailParams;
}

async function getVariantFolderId(auth,rootFolderId){
  var projectFolderId = await getFolderId(auth,process.env.PROJECT_NAME,rootFolderId)
  if (projectFolderId==null){
    projectFolderId =  await createFolderAsync(auth,process.env.PROJECT_NAME,rootFolderId)
  }
  var variantFolderId = await getFolderId(auth,process.env.VARIANT_NAME,projectFolderId)
  if (variantFolderId==null){
    variantFolderId =  await createFolderAsync(auth,process.env.VARIANT_NAME,projectFolderId)
  }
  return variantFolderId;
}

async function getFolderId(auth,folderName,parentFolderId){
  const drive = google.drive({version: 'v3', auth});
  var params = {    
    'q': "name = '" + folderName +"' and '" + parentFolderId +"' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"

  };
  var result = await drive.files.list(params)
  var files = result.data.files
  return files.length==0? null: files[0].id
}

function getNewAccessToken(oAuth2Client) {
  return new Promise(function(resolve, reject) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          reject(err)
        }
        else{
          resolve(token)
        }
      });
    });
  })
}

async function sendEmail(auth,emailParams) {
    var gmailClass = google.gmail('v1');

    var email_lines = [];

    email_lines.push('From: "'+ emailParams.fromName + '" <' + emailParams.fromAddress + '>');
    email_lines.push('To: '+ emailParams.to);
    email_lines.push('Content-type: text/html;charset=iso-8859-1');
    email_lines.push('MIME-Version: 1.0');
    email_lines.push('Subject: ' + emailParams.subject);
    email_lines.push('');
    email_lines.push(emailParams.body);

    var email = email_lines.join('\r\n').trim();

    var base64EncodedEmail = new Buffer(email).toString('base64');
    base64EncodedEmail = base64EncodedEmail.replace(/\+/g, '-').replace(/\//g, '_');
    return await gmailClass.users.messages.send({
      auth: auth,
      userId: 'me',
      resource: {
        raw: base64EncodedEmail
      }
    });
}

async function createFolderAsync(auth,folderName,parentFolderId){
  const drive = google.drive({version: 'v3', auth});
  var fileMetadata = {
    'name': folderName,
    'parents':[parentFolderId],
    'mimeType': 'application/vnd.google-apps.folder'

  };
  var result =  await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });
  return result.data.id
}



async function uploadFileAsync(auth,fileLocation,fileName,description,driveFolderId){
  console.log(fileLocation)
    const drive = google.drive({version: 'v3', auth});
    var fileMetadata = {
      'name': fileName,
      'description': description,
      'parents':[driveFolderId]
    };
    var media = {
      mimeType: 'application/vnd.android.package-archive',
      body: fs.createReadStream(fileLocation)
    };
    var result = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    return result.data.id;
  }

  
async function shareFile(auth,fileId){
    const drive = google.drive({version: 'v3', auth});
    const resource = {"role": "reader", "type": "domain","domain":process.env.DOMAIN};
    //const resource = {"role": "reader", "type": "anyone"};
    return drive.permissions.create({fileId:fileId, resource: resource});
}





