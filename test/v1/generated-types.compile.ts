import type {
  AddChange,
  Consumer,
  DetectorSpecificChange,
  RemoveChange,
  SeipDeclaration,
} from "../../src/generated/protocol-types.js";

const changeCore = {
  change_id:
    "chg_sha256_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  fingerprint_version: "1" as const,
  schema_kind: "json-schema",
  target: {
    object: "Order",
    path: [],
  },
  compatibility: "breaking" as const,
};

const validDetectorChange: DetectorSpecificChange = {
  ...changeCore,
  kind: "warehouse:rename",
};

const invalidDetectorChange: DetectorSpecificChange = {
  ...changeCore,
  // @ts-expect-error detector-specific kinds require a namespace separator
  kind: "warehouse",
};

const invalidAddChange: AddChange = {
  ...changeCore,
  kind: "add",
  after: "new",
  // @ts-expect-error add changes cannot carry a before snapshot
  before: "old",
};

const invalidRemoveChange: RemoveChange = {
  ...changeCore,
  kind: "remove",
  before: "old",
  // @ts-expect-error remove changes cannot carry an after snapshot
  after: "new",
};

const extensibleConsumer: Consumer = {
  team: "analytics",
  custom_owner: "data-platform",
};

const invalidConsumer: Consumer = {
  team: "analytics",
  // @ts-expect-error the legacy Consumer.status field is forbidden
  status: "ACTIVE",
};

type FingerprintVersion =
  SeipDeclaration["changes"][number]["fingerprint_version"];
const fingerprintVersion: FingerprintVersion = "1";
const exactFingerprintVersion: "1" = fingerprintVersion;

void validDetectorChange;
void invalidDetectorChange;
void invalidAddChange;
void invalidRemoveChange;
void extensibleConsumer;
void invalidConsumer;
void fingerprintVersion;
void exactFingerprintVersion;
