CREATE TABLE IF NOT EXISTS `sentiment_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `symbol` varchar(30) NOT NULL,
  `company_name` varchar(150) DEFAULT NULL,
  `overall_sentiment` enum('Positive','Neutral','Negative') NOT NULL,
  `average_score` decimal(4,2) NOT NULL,
  `total_news` smallint unsigned NOT NULL,
  `positive_count` smallint unsigned NOT NULL,
  `neutral_count` smallint unsigned NOT NULL,
  `negative_count` smallint unsigned NOT NULL,
  `source` varchar(60) NOT NULL DEFAULT 'Google News RSS',
  `analyzed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sentiment_symbol_time` (`symbol`,`analyzed_at`),
  KEY `idx_sentiment_analyzed_at` (`analyzed_at`),
  CONSTRAINT `chk_sentiment_counts` CHECK (
    `total_news` = (`positive_count` + `neutral_count` + `negative_count`)
  ),
  CONSTRAINT `chk_sentiment_score` CHECK (
    `average_score` BETWEEN -1.00 AND 1.00
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
