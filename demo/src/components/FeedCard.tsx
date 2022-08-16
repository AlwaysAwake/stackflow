import { motion } from "framer-motion";
import React from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

import { useFlow } from "../stackflow";
import * as css from "./FeedCard.css";

interface FeedCardProps {
  articleId: string;
  title: string;
  region: string;
  price: number;
  daysAgo: number;
}
const FeedCard: React.FC<FeedCardProps> = ({
  articleId,
  title,
  price,
  region,
  daysAgo,
}) => {
  const { push } = useFlow();

  const imageUrl = `https://picsum.photos/800/800/?id=${articleId}`;

  const onClick = () => {
    push("Article", {
      articleId: String(articleId),
      title,
    });
  };

  return (
    <div className={css.container}>
      <button type="button" className={css.button} onClick={onClick}>
        <motion.div
          className={css.thumbnail}
          layoutId={`article-image-${articleId}`}
          transition={{
            layout: {
              duration: 0.35,
            },
          }}
        >
          <LazyLoadImage
            src={imageUrl}
            effect="opacity"
            width={108}
            height={108}
          />
        </motion.div>
        <div className={css.right}>
          <div className={css.title}>{title}</div>
          <div className={css.subtitle}>
            {region} · {daysAgo} day ago
          </div>
          <div className={css.price}>£{price}.00</div>
        </div>
      </button>
    </div>
  );
};

export default FeedCard;
