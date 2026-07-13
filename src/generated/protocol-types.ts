// Generated from seip.schema.json. Do not edit.

export type ProtocolVersion = string;
export type DeclarationIdentifier = string;
export type RFC3339Timestamp = string;
export type DeclarationRevision = number;
export type DeclarationStatus =
  "DRAFT" | "PROPOSED" | "UNDER_REVIEW" | "ACCEPTED" | "ENFORCING" | "COMPLETED" | "WITHDRAWN" | "REJECTED";
export type TeamIdentifier = string;
export type NormalizedChange = AddChange | RemoveChange | BeforeAndAfterChange | UnknownChange | DetectorSpecificChange;
export type AddChange = NormalizedChangeCore & {
  kind: "object_add" | "add";
  after: SnapshotValue;
  before?: never;
};
export type ChangeIdentifier = string;
export type NonEmptyString = string;
export type TaggedPathSegment = PropertyPathSegment | ArrayItemsPathSegment | TupleItemPathSegment;
export type ChangeKind =
  | (
      | "object_add"
      | "add"
      | "object_remove"
      | "remove"
      | "rename"
      | "retype"
      | "make_required"
      | "make_optional"
      | "make_non_nullable"
      | "make_nullable"
      | "enum_narrow"
      | "enum_widen"
      | "format_change"
      | "constraint_change"
      | "deprecate"
      | "unknown"
    )
  | string;
export type SnapshotValue = null | boolean | string | CanonicalValue | SnapshotValue[] | SnapshotRecord;
export type CanonicalValue =
  CanonicalNull | CanonicalBoolean | CanonicalString | CanonicalNumber | CanonicalArray | CanonicalObject;
export type RemoveChange = NormalizedChangeCore & {
  kind: "object_remove" | "remove";
  before: SnapshotValue;
  after?: never;
};
export type BeforeAndAfterChange = NormalizedChangeCore & {
  kind:
    | "rename"
    | "retype"
    | "make_required"
    | "make_optional"
    | "make_non_nullable"
    | "make_nullable"
    | "enum_narrow"
    | "enum_widen"
    | "format_change"
    | "constraint_change"
    | "deprecate";
  before: SnapshotValue;
  after: SnapshotValue;
};
export type UnknownChange =
  | (NormalizedChangeCore & {
      kind: "unknown";
      before: SnapshotValue;
    })
  | (NormalizedChangeCore & {
      kind: "unknown";
      after: SnapshotValue;
    });
export type DetectorSpecificChange = NormalizedChangeCore & {
  kind: string;
};
export type NonEmptyTrimmedString = string;
export type ConsumerDependencies = string[];
export type ResponseIdentifier = string;
export type ConsumerResponseDecision = "ACKNOWLEDGED" | "OBJECTED" | "EXTENSION_REQUESTED";
export type EvidenceIdentifier = string;
export type ValidatorIdentifier = string;
export type SHA256Digest = string;
export type EvidenceResult = "PASSED" | "FAILED";
export type EvidenceArtifactURI = string;
export type LifecycleEvent =
  | CreatedEvent
  | DeclarationUpdatedEvent
  | ConsumerRespondedEvent
  | EvidenceRecordedEvent
  | WithdrawnOrRejectedEvent
  | StatusOnlyEvent;
export type CreatedEvent = LifecycleEventCore & {
  type: "CREATED";
  details?: ExtensibleEventDetails;
};
export type EventIdentifier = string;
export type LifecycleEventType =
  | "CREATED"
  | "DECLARATION_UPDATED"
  | "PROPOSED"
  | "CONSUMER_RESPONDED"
  | "EVIDENCE_RECORDED"
  | "ACCEPTED"
  | "ENFORCING"
  | "COMPLETED"
  | "WITHDRAWN"
  | "REJECTED";
export type DeclarationUpdatedEvent = LifecycleEventCore & {
  type: "DECLARATION_UPDATED";
  details: DeclarationUpdatedEventDetails;
};
export type ConsumerRespondedEvent = LifecycleEventCore & {
  type: "CONSUMER_RESPONDED";
  details: ConsumerRespondedEventDetails;
};
export type EvidenceRecordedEvent = LifecycleEventCore & {
  type: "EVIDENCE_RECORDED";
  details: EvidenceRecordedEventDetails;
};
export type WithdrawnOrRejectedEvent = LifecycleEventCore & {
  type: "WITHDRAWN" | "REJECTED";
  details: ReasonEventDetails;
};
export type StatusOnlyEvent = LifecycleEventCore & {
  type: "PROPOSED" | "ACCEPTED" | "ENFORCING" | "COMPLETED";
  details?: ExtensibleEventDetails;
};

export interface SEIPV1Declaration {
  protocol_version: ProtocolVersion;
  declaration_id: DeclarationIdentifier;
  created_at: RFC3339Timestamp;
  revision: DeclarationRevision;
  status: DeclarationStatus;
  producer: Producer;
  /**
   * @minItems 1
   */
  changes: [NormalizedChange, ...NormalizedChange[]];
  intent: DeclarationIntent;
  consumers: Consumer[];
  responses: ConsumerResponse[];
  evidence: ValidationEvidence[];
  events: LifecycleEvent[];
  [k: string]: unknown;
}
export interface Producer {
  team: TeamIdentifier;
  contact?: string;
  [k: string]: unknown;
}
export interface NormalizedChangeCore {
  change_id: ChangeIdentifier;
  fingerprint_version: 1;
  schema_kind: NonEmptyString;
  target: ChangeTarget;
  kind: ChangeKind;
  compatibility: "compatible" | "breaking" | "unknown";
  before?: SnapshotValue;
  after?: SnapshotValue;
  [k: string]: unknown;
}
export interface ChangeTarget {
  object: NonEmptyString;
  path: TaggedPathSegment[];
  [k: string]: unknown;
}
export interface PropertyPathSegment {
  type: "property";
  name: string;
}
export interface ArrayItemsPathSegment {
  type: "items";
}
export interface TupleItemPathSegment {
  type: "tuple_item";
  index: number;
}
export interface CanonicalNull {
  kind: "null";
}
export interface CanonicalBoolean {
  kind: "boolean";
  value: boolean;
}
export interface CanonicalString {
  kind: "string";
  value: string;
}
export interface CanonicalNumber {
  kind: "number";
  decimal: string;
}
export interface CanonicalArray {
  kind: "array";
  items: CanonicalValue[];
}
export interface CanonicalObject {
  kind: "object";
  entries: CanonicalObjectEntry[];
}
export interface CanonicalObjectEntry {
  key: string;
  value: CanonicalValue;
}
export interface SnapshotRecord {
  [k: string]: SnapshotValue;
}
export interface DeclarationIntent {
  summary: string;
  rationale: NonEmptyTrimmedString;
  migration: MigrationIntent;
  timeline: IntentTimeline;
  [k: string]: unknown;
}
export interface MigrationIntent {
  strategy: NonEmptyString;
  steps?: string[];
  rollback?: string;
  [k: string]: unknown;
}
export interface IntentTimeline {
  review_deadline: RFC3339Timestamp;
  target_enforcement_at: RFC3339Timestamp;
  deprecation_at?: RFC3339Timestamp;
  removal_at?: RFC3339Timestamp;
  [k: string]: unknown;
}
export interface Consumer {
  team: TeamIdentifier;
  contact?: string;
  dependencies?: ConsumerDependencies;
  [k: string]: unknown;
}
export interface ConsumerResponse {
  response_id: ResponseIdentifier;
  declaration_revision: DeclarationRevision;
  team: TeamIdentifier;
  decision: ConsumerResponseDecision;
  message: string;
  actor: string;
  at: RFC3339Timestamp;
  [k: string]: unknown;
}
export interface ValidationEvidence {
  evidence_id: EvidenceIdentifier;
  declaration_revision: DeclarationRevision;
  team: TeamIdentifier;
  validator_id: ValidatorIdentifier;
  validator_version?: string;
  /**
   * @minItems 1
   */
  change_ids: [ChangeIdentifier, ...ChangeIdentifier[]];
  source_digests: EvidenceSourceDigests;
  result: EvidenceResult;
  at: RFC3339Timestamp;
  summary: string;
  artifact?: EvidenceArtifact;
  [k: string]: unknown;
}
export interface EvidenceSourceDigests {
  [k: string]: SHA256Digest;
}
export interface EvidenceArtifact {
  uri: EvidenceArtifactURI;
  sha256: SHA256Digest;
  [k: string]: unknown;
}
export interface LifecycleEventCore {
  event_id: EventIdentifier;
  type: LifecycleEventType;
  declaration_revision: DeclarationRevision;
  at: RFC3339Timestamp;
  actor: string;
  from_status: DeclarationStatus | null;
  to_status: DeclarationStatus | null;
  details?: {};
  [k: string]: unknown;
}
export interface ExtensibleEventDetails {
  [k: string]: unknown;
}
export interface DeclarationUpdatedEventDetails {
  reason: string;
  changed_paths: string[];
  before_digest: SHA256Digest;
  after_digest: SHA256Digest;
  [k: string]: unknown;
}
export interface ConsumerRespondedEventDetails {
  response_id: ResponseIdentifier;
  team: TeamIdentifier;
  decision: ConsumerResponseDecision;
  [k: string]: unknown;
}
export interface EvidenceRecordedEventDetails {
  evidence_id: EvidenceIdentifier;
  team: TeamIdentifier;
  result: EvidenceResult;
  [k: string]: unknown;
}
export interface ReasonEventDetails {
  reason: string;
  [k: string]: unknown;
}
