/**
 * @luogu-discussion-archive/remark-lda-lfm
 * Copyright (c) 2025 Luogu Discussion Archive Project
 *
 * Licensed under GNU Affero General Public License version 3 or later.
 * See the index.js file for details.
 *
 * @license AGPL-3.0-or-later
 */

import "mdast";

declare module "mdast" {
  interface UserMention extends Parent {
    type: "userMention";
    uid: number;
    children: PhrasingContent[];
  }

  interface BilibiliVideo extends Node {
    type: "bilibiliVideo";
    videoId: string;
  }

  interface LfmAdmonition extends Parent {
    type: "lfmAdmonition";
    children: BlockContent[];
  }

  interface PhrasingContentMap {
    userMention: UserMention;
    bilibiliVideo: BilibiliVideo;
  }

  interface RootContentMap {
    userMention: UserMention;
    bilibiliVideo: BilibiliVideo;
    lfmAdmonition: LfmAdmonition;
  }

  interface BlockContentMap {
    lfmAdmonition: LfmAdmonition;
  }
}

export default function remarkLuoguFlavor(): (
  tree: import("mdast").Root,
) => void;
