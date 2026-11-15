/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as boxes from "../boxes.js";
import type * as edit from "../edit.js";
import type * as exports from "../exports.js";
import type * as files from "../files.js";
import type * as impl_boxes_attachModel from "../impl/boxes/attachModel.js";
import type * as impl_boxes_claim from "../impl/boxes/claim.js";
import type * as impl_boxes_create from "../impl/boxes/create.js";
import type * as impl_boxes_get from "../impl/boxes/get.js";
import type * as impl_boxes_inbox from "../impl/boxes/inbox.js";
import type * as impl_boxes_open from "../impl/boxes/open.js";
import type * as impl_boxes_reply from "../impl/boxes/reply.js";
import type * as impl_boxes_seal from "../impl/boxes/seal.js";
import type * as impl_boxes_submitEdit from "../impl/boxes/submitEdit.js";
import type * as kara from "../kara.js";
import type * as lib_code from "../lib/code.js";
import type * as lib_cutout from "../lib/cutout.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_mock from "../lib/mock.js";
import type * as lib_status from "../lib/status.js";
import type * as lib_view from "../lib/view.js";
import type * as prepare from "../prepare.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  boxes: typeof boxes;
  edit: typeof edit;
  exports: typeof exports;
  files: typeof files;
  "impl/boxes/attachModel": typeof impl_boxes_attachModel;
  "impl/boxes/claim": typeof impl_boxes_claim;
  "impl/boxes/create": typeof impl_boxes_create;
  "impl/boxes/get": typeof impl_boxes_get;
  "impl/boxes/inbox": typeof impl_boxes_inbox;
  "impl/boxes/open": typeof impl_boxes_open;
  "impl/boxes/reply": typeof impl_boxes_reply;
  "impl/boxes/seal": typeof impl_boxes_seal;
  "impl/boxes/submitEdit": typeof impl_boxes_submitEdit;
  kara: typeof kara;
  "lib/code": typeof lib_code;
  "lib/cutout": typeof lib_cutout;
  "lib/errors": typeof lib_errors;
  "lib/mock": typeof lib_mock;
  "lib/status": typeof lib_status;
  "lib/view": typeof lib_view;
  prepare: typeof prepare;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
