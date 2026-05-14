import React from "react";
import { Composition } from "remotion";

import { InstagramStory } from "./InstagramStory";
import { TwitterPost } from "./TwitterPost";

// 30 fps everywhere — calmer than 60 for fade-heavy compositions and
// halves render time without visible quality loss for this kind of motion.
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="InstagramStory"
        component={InstagramStory}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TwitterPost"
        component={TwitterPost}
        durationInFrames={FPS * 16}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
