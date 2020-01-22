const AWS = require('aws-sdk');
const fs = require('fs');
const ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET = process.env.AWS_ACCESS_KEY;


const BUCKET_NAME = process.env.S3_BUCKET_NAME

const s3 = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});


const uploadFile = async (projectName,variantName,fileNameToUse,filePath)  =>   {
    const fileContent = fs.readFileSync(filePath);
    const params = {
        Key:`${projectName}/${variantName}/${fileNameToUse}`,
        Bucket: BUCKET_NAME,
        Body: fileContent,
        ACL:'public-read'
    };
    await s3.upload(params).promise()
    return `https://${encodeURIComponent(params.Bucket)}.s3.amazonaws.com/${encodeURIComponent(params.Key)}`
};

exports.uploadS3 = uploadFile
