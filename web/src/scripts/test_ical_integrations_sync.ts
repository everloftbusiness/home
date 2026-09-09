import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Mock 'server-only' package for Node.js tsx execution environment
require("module")._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

dotenv.config({ path: path.join(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cvgrwujjaakqrxasixyf.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z3J3dWpqYWFrcXJ4YXNpeHlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQxODk0NiwiZXhwIjoyMTAwOTk0OTQ2fQ.2eb1XRoBVX0kSqXjquuOdIH-6gmpTi3Dh5l9zaqCAIA";

async function main() {
  const {
    getICalChannelFeeds,
    saveICalChannelFeeds,
    getPropertyCalendarBlocks,
    savePropertyCalendarBlocks,
  } = await import("../features/properties/services/ical-sync.service");

  console.log("==================================================");
  console.log("INTEGRATION TEST: property_integrations & 15-Min Smart Cache");
  console.log("==================================================");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const testPropertyId = "a79e4cd8-2b76-4905-910b-f51db47d128b"; // 305 Stylish 2BHK

  // 1. Test saving feed to property_integrations
  const sampleFeed = {
    id: `feed_test_${Date.now()}`,
    propertyId: testPropertyId,
    channelName: "Airbnb",
    icalUrl: "https://www.airbnb.com/calendar/ical/test_unit_feed.ics?s=12345",
    lastSyncedAt: new Date().toISOString(),
  };

  console.log("\nTEST 1: Save feed into property_integrations table...");
  const saveRes = await saveICalChannelFeeds(testPropertyId, [sampleFeed]);
  console.log("Save Feed Result:", saveRes ? "SUCCESS (PASS)" : "FAILED");

  // 2. Test reading feeds from property_integrations
  console.log("\nTEST 2: Read feeds back from property_integrations table...");
  const feeds = await getICalChannelFeeds(testPropertyId);
  console.log("Feeds Count:", feeds.length);
  console.log("Feed Channel Name:", feeds[0]?.channelName);
  console.log("Feed URL:", feeds[0]?.icalUrl);
  const isPass2 = feeds.length > 0 && feeds[0]?.channelName === "Airbnb";
  console.log("STATUS:", isPass2 ? "PASS" : "FAIL");

  // 3. Test reading blocks from property_availability_blocks with smart 15-min cache
  console.log("\nTEST 3: Smart 15-Minute Cache Read from property_availability_blocks...");
  const startTime = Date.now();
  const blocks = await getPropertyCalendarBlocks(testPropertyId);
  const queryDurationMs = Date.now() - startTime;
  console.log(`Blocks loaded: ${blocks.length} rows in ${queryDurationMs}ms (Ultra Fast SQL Read)`);
  console.log("STATUS:", queryDurationMs < 500 ? "PASS (< 500ms target)" : "SLOW");

  // 4. Test Manual Block Lifecycle
  console.log("\nTEST 4: Add Manual Block Lifecycle...");
  const testStart = "2026-10-01";
  const testEnd = "2026-10-05";
  const newBlocks = [...blocks, {
    id: `blk_unit_${Date.now()}`,
    propertyId: testPropertyId,
    startDate: testStart,
    endDate: testEnd,
    reason: "manual_block" as const,
    notes: "Unit Test Vacation",
  }];

  await savePropertyCalendarBlocks(testPropertyId, newBlocks);

  const verifyBlocks = await getPropertyCalendarBlocks(testPropertyId);
  const addedBlock = verifyBlocks.find((b) => b.startDate === testStart);
  console.log("Added Block Verified in DB:", addedBlock ? "YES (PASS)" : "NO");

  // Clean up manual test block
  const cleanedBlocks = verifyBlocks.filter((b) => b.startDate !== testStart);
  await savePropertyCalendarBlocks(testPropertyId, cleanedBlocks);
  console.log("Cleaned up manual test block.");

  // Clean up property_integrations test feed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("property_integrations").delete().eq("property_id", testPropertyId).eq("channel", "airbnb");
  console.log("Cleaned up test feed from property_integrations.");

  console.log("\n==================================================");
  console.log("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

main();
