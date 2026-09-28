import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load env


class S3Service {
constructor() {
  

this.bucketName = process.env.AWSS3_BUCKET_NAME;

  if (!this.bucketName) {
    throw new Error("❌ Bucket name missing in ENV");
  }

  this.s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

async getAllCommunityImg() {
    try {
      let allImages = await redis.hgetall('all_community_images');
      console.log('allImages', allImages);
      if (!Object.keys(allImages).length) {
        let allimg = await this.fetchAndCacheCommunityImages();
        console.log('allImags', allimg);
        allImages = await redis.hgetall('all_community_images');
      }

      const updated = Object.entries(allImages).map(([id, urlJson]) => {
        const urls = JSON.parse(urlJson);
        const url = urls[0]; // Assuming one image per community
        const imageName = url.split('/').pop();
        return {
          id,
          url,
          name: imageName.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, ''),
        };
      });

      console.log('Updated images: ', updated);
      return updated;
    } catch (err) {
      console.error('Error in getAllCommunityImg:', err);
      return [];
    }
  }
 async listFolders(prefix) {
  if (!this.bucketName) {
    throw new Error("Bucket env variable is missing");
  }

  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

  const result = await this.s3.send(
    new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: normalizedPrefix,
      Delimiter: "/", // 🔥 This makes S3 return folder-like prefixes
    })
  );

  // CommonPrefixes contains "subfolders"
  const folders = (result.CommonPrefixes || []).map((p) => p.Prefix);

  console.log(
    `Found ${folders.length} folders in S3 for prefix "${normalizedPrefix}"`
  );

  return folders; 
}



 




 
async listObjects(prefix, ext = null) {
  if (!this.bucketName) {
    throw new Error("Bucket env variable is missing");
  }

  // Normalize prefix (always end with /)
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

  let keys = [];
  let continuationToken;

  do {
    const result = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      })
    );

    if (result.Contents) {
      for (const obj of result.Contents) {
        // Skip "folder" placeholders
        if (!obj.Key || obj.Key.endsWith("/")) continue;
        keys.push(obj.Key);
      }
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  // Optional extension filter (.pdf, .jpg, etc.)
  if (ext) {
    const e = ext.replace(/^\./, "").toLowerCase();
    keys = keys.filter((k) => k.toLowerCase().endsWith(`.${e}`));
  }

  const urls = keys.map(
    (key) =>
      `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURI(key)}`
  );

  console.log(
    `Found ${urls.length} objects in S3 for prefix "${normalizedPrefix}"`
  );

  return urls;
}



  async uploadImages(files, uid, folderType) {
    let folderPath = `${folderType}/${uid}/images/`;
    try {
      await Promise.all(
        files.map(async (file) => {
          const resizedImageBuffer = await sharp(file.buffer).resize(800, 600).toBuffer();
          const filePath = `${folderPath}${file.originalname}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: resizedImageBuffer,
              ContentType: file.mimetype,
            })
          );
        })
      );
      return folderPath;
    } catch (error) {
      throw new Error('Failed to upload images: ' + error.message);
    }
  }

  async uploadImagess(files, folderPath) {
    try {
      const uploadedUrls = [];
      await Promise.all(
        files.map(async (file) => {
          const resizedImageBuffer = await sharp(file.buffer).resize(800, 600).toBuffer();
          const filePath = `${folderPath}${file.originalname}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: resizedImageBuffer,
              ContentType: file.mimetype,
            })
          );
          const fileUrl = `${process.env.S3_LOCATION}/${filePath}`;
          uploadedUrls.push(fileUrl);
        })
      );
      return uploadedUrls;
    } catch (error) {
      throw new Error('Failed to upload images: ' + error.message);
    }
  }

  async uploadVideos(files, folderPath) {
    try {
      const uploadedUrls = [];
      await Promise.all(
        files.map(async (file) => {
          const filePath = `${folderPath}${file.originalname}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: file.buffer,
              ContentType: file.mimetype,
            })
          );
       const fileUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
          uploadedUrls.push(fileUrl);
        })
      );
      return uploadedUrls;
    } catch (error) {
      throw new Error('Failed to upload videos: ' + error.message);
    }
  }

  async uploadImage(file, uid, folderType) {
    const folderPath = `${folderType}/${uid}/`;
    const filePath = `${folderPath}${file.originalname}`;
    try {
      const resizedImageBuffer = await sharp(file.buffer).resize(800, 600).toBuffer();
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
          Body: resizedImageBuffer,
          ContentType: file.mimetype,
        })
      );
      const imageUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
      return imageUrl;
    } catch (error) {
      throw new Error('Failed to upload image: ' + error.message);
    }
  }

  async uploadCommunityImages(files, uid, folderType) {
    let folderPath = `${folderType}/${uid}/`;
    try {
      await Promise.all(
        files.map(async (file) => {
          const resizedImageBuffer = await sharp(file.buffer).resize(800, 600).toBuffer();
          const filePath = `${folderPath}${file.originalname}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: resizedImageBuffer,
              ContentType: file.mimetype,
            })
          );
        })
      );
      return folderPath;
    } catch (error) {
      throw new Error('Failed to upload images: ' + error.message);
    }
  }

  async fetchAndCachePropertyImages() {
    try {
      let allPropertyImages = {};
      let isTruncated = true;
      let continuationToken = null;
      while (isTruncated) {
        const propertyCommand = new ListObjectsV2Command({
          Bucket: process.env.AWSS3_BUCKET_NAME,
          Prefix: 'properties/',
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        });
        const { Contents: propertyContents, IsTruncated, NextContinuationToken } = await this.s3.send(propertyCommand);
        isTruncated = IsTruncated;
        continuationToken = NextContinuationToken;
        if (propertyContents && propertyContents.length > 0) {
          propertyContents.forEach((file) => {
            const match = file.Key.match(/properties\/([^/]+)\/images\/(.+)/);
            if (match) {
              const propertyUid = match[1];
              const imageUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`;
              if (!allPropertyImages[propertyUid]) {
                allPropertyImages[propertyUid] = [];
              }
              allPropertyImages[propertyUid].push(imageUrl);
            }
          });
        }
      }
      if (Object.keys(allPropertyImages).length > 0) {
        await Promise.all(
          Object.entries(allPropertyImages).map(([uid, images]) =>
            redis.hset('all_property_images', uid, JSON.stringify(images))
          )
        );
        await redis.expire('all_property_images', 21600);
      }
      return allPropertyImages;
    } catch (error) {
      console.error('Error fetching and caching property images:', error);
      return {};
    }
  }

 

  async fetchAndCacheCommunityImages() {
  try {
    const client = redis.getClient("rental"); // ✅ use a valid redis key

    let allCommunityImages = {};
    let isTruncated = true;
    let continuationToken = null;

    while (isTruncated) {
      const communityCommand = new ListObjectsV2Command({
        Bucket: process.env.AWSS3_BUCKET_NAME,
        Prefix: 'communities/default_images/',
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const {
        Contents: communityContents,
        IsTruncated,
        NextContinuationToken,
      } = await this.s3.send(communityCommand);

      isTruncated = IsTruncated;
      continuationToken = NextContinuationToken;

      if (communityContents?.length) {
        communityContents.forEach((file) => {
          const match = file.Key.match(
            /communities\/default_images\/([^/]+)\/(.+)/
          );

          if (match) {
            const communityId = match[1];
            const imageUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`;

            if (!allCommunityImages[communityId]) {
              allCommunityImages[communityId] = [];
            }

            allCommunityImages[communityId].push(imageUrl);
          }
        });
      }
    }

    if (Object.keys(allCommunityImages).length > 0) {
      await Promise.all(
        Object.entries(allCommunityImages).map(([uid, images]) =>
          client.hset(
            'all_community_images',
            uid,
            JSON.stringify(images)
          )
        )
      );

      await client.expire('all_community_images', 21600); // 6 hours
    }

    return allCommunityImages;
  } catch (error) {
    console.error('Error fetching and caching community images:', error);
    return {};
  }
}


  async uploadPDFs(files, user_id, prop_id) {
    let folderPath = `users/${user_id}/rentalagreements/RRA_${prop_id}`;
    try {
      await Promise.all(
        files.map(async (file) => {
          const fileExtension = file.originalname.split('.').pop();
          console.log('fileExtension: ', fileExtension);
          const filePath = `${folderPath}.${fileExtension}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: file.buffer,
              ContentType: file.mimetype,
            })
          );
        })
      );
      return folderPath;
    } catch (error) {
      throw new Error('Failed to upload PDFs: ' + error.message);
    }
  }

  async uploadToS31(files, basePath) {
    try {
      const uploadedFiles = [];
      await Promise.all(
        files.map(async (file) => {
          const fileExtension = file.originalname.split('.').pop();
          const cleanName = file.originalname.replace(/\s+/g, '_');
          const filePath = `${basePath}/${cleanName}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: filePath,
              Body: file.buffer,
              ContentType: file.mimetype,
            })
          );
          const fileUrl = `${process.env.S3_LOCATION}/${filePath}`;
          uploadedFiles.push({ url: fileUrl });
        })
      );
      return uploadedFiles;
    } catch (error) {
      throw new Error('Failed to upload files: ' + error.message);
    }
  }

  async uploadToS3(files, basePath) {
  try {
    const uploadedFiles = [];

    await Promise.all(
      files.map(async (file) => {
        const cleanName = file.originalname.replace(/\s+/g, '_');
        const key = `${basePath}/${Date.now()}_${cleanName}`;

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        );

        const url = `${process.env.S3_LOCATION}/${key}`;

        uploadedFiles.push({
          file_name: file.originalname,
          key: key,
          url: url
        });
      })
    );

    return uploadedFiles;

  } catch (error) {
    throw new Error('Failed to upload files: ' + error.message);
  }
}

  async getPDFUrls(folderPath) {
    if (!folderPath) {
      console.error('Folder path is required.');
      return;
    }
    try {
      const listParams = {
        Bucket: this.bucketName,
        Prefix: folderPath.endsWith('/') ? folderPath : folderPath + '/',
      };
      const data = await this.s3.send(new ListObjectsV2Command(listParams));
      console.log('S3 ListObjects Response:', data);
      if (!data.Contents || data.Contents.length === 0) {
        console.log('No files found in the specified folder.');
        return [];
      }
      console.log('S3 Files:', data.Contents.map((item) => item.Key));
      const fileUrls = data.Contents.map(
        (file) => `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`
      );
      return fileUrls;
    } catch (error) {
      console.error('Error fetching PDFs from S3:', error);
      throw new Error('Failed to fetch PDFs: ' + error.message);
    }
  }

  async getPropertyImages(uid) {
    try {
      let images = await redis.hget('all_property_images', uid);
      if (!images) {
        await this.fetchAndCachePropertyImages();
        images = await redis.hget('all_property_images', uid);
      }
      return images ? JSON.parse(images) : [];
    } catch (error) {
      console.error('Error fetching property images from Redis:', error);
      return [];
    }
  }

  async getCommunityImages(uid) {
    try {
      let images = await redis.hget('all_community_images', uid);
      if (!images) {
        await this.fetchAndCacheCommunityImages();
        images = await redis.hget('all_community_images', uid);
      }
      return images ? JSON.parse(images) : [];
    } catch (error) {
      console.error('Error fetching community images from Redis:', error);
      return [];
    }
  }

  async uploadJsonToS3(key, jsonData) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.AWSS3_BUCKET_NAME,
        Key: key,
        Body: jsonData,
        ContentType: 'application/json',
      });
      await this.s3.send(command);
      console.log(`Successfully uploaded JSON to S3: ${key}`);
    } catch (error) {
      console.error('Error uploading JSON to S3:', error);
      throw new Error('Failed to upload JSON to S3.');
    }
  }

  async getJsonFromS3(s3Key) {
    try {
      const params = {
        Bucket: process.env.AWSS3_BUCKET_NAME,
        Key: s3Key,
      };
      const command = new GetObjectCommand(params);
      const response = await this.s3.send(command);
      const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          stream.on('error', reject);
        });
      const jsonString = await streamToString(response.Body);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error(`Error retrieving JSON from S3 (${s3Key}):`, error);
      throw new Error('Failed to retrieve JSON from S3');
    }
  }

  async listFilesInS3Folder(folderPath) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderPath,
      });
      const response = await this.s3.send(command);
      if (!response.Contents || response.Contents.length === 0) {
        console.log(`No files found in S3 folder: ${folderPath}`);
        return [];
      }
      const fileKeys = response.Contents.map((file) => file.Key);
      return fileKeys;
    } catch (error) {
      console.error(`Error listing files in S3 folder (${folderPath}):`, error.message);
      throw new Error('Failed to list files in S3.');
    }
  }

  async getSubTaskMediaUrls(mediaPathObj) {
    if (!mediaPathObj) {
      return { images: { before: [], after: [] }, videos: { before: [], after: [] } };
    }
    const s3Client = this.s3;
    const bucketName = this.bucketName;
    const region = process.env.AWS_REGION;
    const mediaTypes = ['images', 'videos'];
    const events = ['before', 'after'];
    const result = { images: { before: [], after: [] }, videos: { before: [], after: [] } };
    try {
      for (const type of mediaTypes) {
        for (const evt of events) {
          const folder = mediaPathObj[type]?.[evt]?.path;
          if (!folder) continue;
          const prefix = folder.endsWith('/') ? folder : folder + '/';
          const data = await s3Client.send(
            new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix })
          );
          if (data.Contents && data.Contents.length > 0) {
            result[type][evt] = data.Contents.map(
              (item) => `https://${bucketName}.s3.${region}.amazonaws.com/${item.Key}`
            );
          }
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching sub-task media from S3:', error);
      throw new Error('Failed to fetch media: ' + error.message);
    }
  }

 
  async getSubTaskMediaUrls(baseMediaPath) {
    if (!baseMediaPath) {
      return { images: { before: [], after: [] }, videos: { before: [], after: [] } };
    }
    const result = { images: { before: [], after: [] }, videos: { before: [], after: [] } };
    const mediaTypes = ['images', 'videos'];
    const events = ['before', 'after'];
    try {
      for (const type of mediaTypes) {
        for (const evt of events) {
          const folder = `${baseMediaPath}${type.charAt(0).toUpperCase() + type.slice(1)}/${evt}/`;
          const data = await this.s3.send(
            new ListObjectsV2Command({ Bucket: this.bucketName, Prefix: folder })
          );
          if (data.Contents && data.Contents.length > 0) {
            result[type][evt] = data.Contents.map(
              (item) => `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
            );
          }
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching sub-task media from S3:', error);
      return result;
    }
  }

  async ensureFolderExists(folderPath) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderPath,
        MaxKeys: 1,
      });
      const { Contents } = await this.s3.send(command);
      console.log('contents', Contents);
      if (!Contents || Contents.length === 0) {
        const createFolder = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `${folderPath}`,
          Body: '',
        });
        await this.s3.send(createFolder);
        console.log(`Created folder: ${folderPath}`);
      }
    } catch (error) {
      console.error(`Error checking/creating folder ${folderPath}:`, error);
    }
  }

  async deleteImage(imagePaths) {
    if (!imagePaths || imagePaths.length === 0) {
      return;
    }
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Delete: { Objects: imagePaths.map((path) => ({ Key: path })), Quiet: false },
      };
      await this.s3.send(new DeleteObjectsCommand(deleteParams));
      const uidSet = new Set();
      imagePaths.forEach((path) => {
        const match = path.match(/property_images\/([^/]+)\//);
        if (match) {
          uidSet.add(match[1]);
        }
      });
      for (let uid of uidSet) {
        let cachedImages = await redis.hget('all_property_images', uid);
        if (cachedImages) {
          let updatedImages = JSON.parse(cachedImages).filter(
            (img) =>
              !imagePaths.includes(
                img.replace(`https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`, '')
              )
          );
          if (updatedImages.length > 0) {
            await redis.hset('all_property_images', uid, JSON.stringify(updatedImages));
          } else {
            await redis.hdel('all_property_images', uid);
          }
        }
      }
      console.log('Images successfully deleted from S3 and Redis updated.');
    } catch (error) {
      console.error('Error deleting images from S3:', error);
      throw new Error('Failed to delete images: ' + error.message);
    }
  }
 async deleteObjects(keys = []) {
  if (!keys.length) return;

  const objects = keys.map(Key => ({ Key }));

  await this.s3.send(
    new DeleteObjectsCommand({
      Bucket: this.bucketName,
      Delete: { Objects: objects }
    })
  );
}
async listKeys(prefix, extension = null) {
  const keys = [];
  let ContinuationToken;

  do {
    const res = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken
      })
    );

    (res.Contents || []).forEach(obj => {
      if (!extension || obj.Key.endsWith(extension)) {
        keys.push(obj.Key);
      }
    });

    ContinuationToken = res.NextContinuationToken;
  } while (ContinuationToken);

  return keys;
}
}

export default S3Service;