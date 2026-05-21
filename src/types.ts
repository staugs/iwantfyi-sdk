/**
 * iwant.fyi demand-side protocol v1.0 types.
 * See https://iwant.fyi/protocol/v1 for the canonical spec.
 */

export type WantCategory = "goods" | "services" | "other";
export type SupplyMode = "new" | "used" | "any";
export type ListingCondition = "new" | "like-new" | "good" | "fair" | "used" | "unknown";
export type DemandOutcomeEvent =
  | "viewed"
  | "clicked"
  | "started_checkout"
  | "purchased"
  | "abandoned"
  | "not_purchased";

export interface Location {
  text?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}

export interface Constraints {
  rules?: {
    price_max?: number;
    price_min?: number;
    shipping_max_cents?: number;
    total_price_max?: number;
    condition_min?: ListingCondition;
    condition_exact?: ListingCondition;
    must_be_unopened?: boolean;
    manufacturer_warranty_required?: boolean;
    deadline?: string;
    available_within_days?: number;
    return_window_days_min?: number;
    brand_allowlist?: string[];
    brand_blocklist?: string[];
    manufacturer_required?: string;
    country_of_origin_allowlist?: string[];
    pickup_required?: boolean;
    shipping_required?: boolean;
    local_only?: boolean;
    specs?: Record<string, unknown>;
    [key: string]: unknown;
  };
  negotiable?: string[];
  auto_accept?: Record<string, unknown> | null;
}

export interface Origin {
  agent_id?: string;
  agent_name?: string;
  session_id?: string;
}

export interface CreateWantInput {
  title: string;
  description?: string;
  price_cents: number;
  price_currency?: string;
  category?: WantCategory;
  vertical?: string;
  mode?: SupplyMode;
  location?: Location | string;
  constraints?: Constraints;
  origin?: Origin;
  expires_at?: string;
}

export interface Want {
  id: string;
  protocol_version?: string;
  title: string;
  description?: string;
  price_cents: number;
  price_currency: string;
  category?: WantCategory;
  vertical?: string;
  mode?: SupplyMode | null;
  location?: Location | string | null;
  constraints?: Constraints;
  origin?: Origin;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Match {
  id: string;
  source: string;
  source_id?: string;
  title: string;
  description?: string;
  price_cents: number;
  price_currency?: string;
  shipping_cents?: number;
  total_price_cents?: number;
  condition?: ListingCondition;
  mode?: SupplyMode;
  location?: string;
  images?: string[];
  url?: string;
  direct_url?: string;
  score: number;
  reasons?: string[];
  attributes?: Record<string, unknown>;
  supply_metadata?: Record<string, unknown>;
}

export interface MatchResponse {
  want_id?: string;
  matches: Match[];
  match_count: number;
  sources_consulted?: string[];
  generated_at?: string;
}

export interface CreateWantResponse {
  protocol_version: string;
  want: Want;
  matches: MatchResponse;
}

export interface RecordOutcomeInput {
  want_id: string;
  match_id: string;
  event: DemandOutcomeEvent;
  match_source?: string;
  timestamp?: string;
  value_cents?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordOutcomeResponse {
  received: boolean;
  outcome_id?: string;
  idempotent?: boolean;
}

export interface Vertical {
  id: string;
  display_name: string;
  description: string;
  supported_spec_keys: string[];
  active_supply_sources?: string[];
}

export interface ListVerticalsResponse {
  protocol_version: string;
  verticals: Vertical[];
}

export interface ListConstraintsResponse {
  protocol_version: string;
  constraints: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface HealthResponse {
  protocol_version: string;
  server: string;
  version: string;
  status: string;
  supply_sources?: string[];
  pending_supply_sources?: string[];
  spec_url?: string;
}
