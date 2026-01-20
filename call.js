import {
  S3Client,
  S3ServiceException,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import "dotenv/config";

console.log(process.env.SPACES_KEY);
console.log(process.env.SPACES_SECRET);

const client = new S3Client({
  endpoint: "https://sgp1.digitaloceanspaces.com", // <-- region endpoint, no bucket
  region: "sgp1", // OK to use the provider region string
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
  forcePathStyle: false, // use virtual-hosted style (bucket.region.digitaloceanspaces.com)
});

async function getBackupObjects(
  bucketName = "kmp-katana-backup",
  pageSize = 100,
) {
  const items = [];
  const paginator = paginateListObjectsV2(
    { client, pageSize: Number.parseInt(pageSize, 10) },
    { Bucket: bucketName },
  );

  for await (const page of paginator) {
    const contents = page.Contents || [];
    for (const o of contents) {
      items.push({
        Key: o.Key,
        LastModified: o.LastModified,
        Size: o.Size,
      });
    }
  }

  return items;
}

async function main() {
  try {
    const data = await getBackupObjects();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

main().catch(console.error);
