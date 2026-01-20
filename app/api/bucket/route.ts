import { S3Client, paginateListObjectsV2 } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

const client = new S3Client({
    endpoint: "https://sgp1.digitaloceanspaces.com",
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!,
    },
    forcePathStyle: false,
});

// Base prefix to skip nested directories
const BASE_PREFIX = "data/coolify/backups/databases/root-team-0/";

// Friendly name mapping for folders
const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    "katana-db-v0sooc0kk00084w8wkkoo0sc": "Backup Katana",
    "mysql-database-uc4w4000k4sgo40k0s4ccws4-uc4w4000k4sgo40k0s4ccws4": "Backup KMP",
};

interface S3Object {
    key: string;
    lastModified: Date | undefined;
    size: number | undefined;
    isFolder: boolean;
}

interface FolderContent {
    path: string;
    folders: { name: string; displayName: string }[];
    files: S3Object[];
}

function parseFolderStructure(
    objects: { Key?: string; LastModified?: Date; Size?: number }[],
    prefix: string
): FolderContent {
    const folders = new Set<string>();
    const files: S3Object[] = [];

    const fullPrefix = BASE_PREFIX + prefix;

    for (const obj of objects) {
        if (!obj.Key) continue;

        // Skip if doesn't start with full prefix
        if (!obj.Key.startsWith(fullPrefix)) continue;

        // Get the remaining path after full prefix
        const relativePath = obj.Key.slice(fullPrefix.length);
        if (!relativePath) continue;

        // Check if this is a direct child or nested
        const parts = relativePath.split("/").filter(Boolean);

        if (parts.length === 1) {
            // Direct file
            files.push({
                key: obj.Key,
                lastModified: obj.LastModified,
                size: obj.Size,
                isFolder: false,
            });
        } else if (parts.length > 1) {
            // This is inside a subfolder, add the folder name
            folders.add(parts[0]);
        }
    }

    const folderList = Array.from(folders)
        .sort()
        .map((name) => ({
            name,
            displayName: FOLDER_DISPLAY_NAMES[name] || name,
        }));

    return {
        path: prefix,
        folders: folderList,
        files: files.sort((a, b) => a.key.localeCompare(b.key)),
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || "";

    try {
        const items: { Key?: string; LastModified?: Date; Size?: number }[] = [];
        const paginator = paginateListObjectsV2(
            { client, pageSize: 1000 },
            { Bucket: "kmp-katana-backup" }
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

        const result = parseFolderStructure(items, prefix);
        return NextResponse.json(result);
    } catch (error) {
        console.error("S3 Error:", error);
        return NextResponse.json(
            { error: "Failed to list bucket contents" },
            { status: 500 }
        );
    }
}
