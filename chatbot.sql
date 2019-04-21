-- MySQL dump 10.13  Distrib 8.0.14, for macos10.14 (x86_64)
--
-- Host: localhost    Database: chatbot
-- ------------------------------------------------------
-- Server version	8.0.13

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
 SET NAMES utf8 ;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `button`
--

DROP TABLE IF EXISTS `button`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `button` (
  `buttonId` bigint(20) DEFAULT NULL,
  `position` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `url` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `postback` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `button`
--

LOCK TABLES `button` WRITE;
/*!40000 ALTER TABLE `button` DISABLE KEYS */;
/*!40000 ALTER TABLE `button` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pages`
--

DROP TABLE IF EXISTS `pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `pages` (
  `id` bigint(20) NOT NULL,
  `pageName` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `pageId` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `pageAccessToken` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `subscribed` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  KEY `id_idx` (`id`),
  CONSTRAINT `id` FOREIGN KEY (`id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pages`
--

LOCK TABLES `pages` WRITE;
/*!40000 ALTER TABLE `pages` DISABLE KEYS */;
INSERT INTO `pages` VALUES (2379359148770565,'Testdrivemulu','413245412820200','EAALux5Ptc6QBALHAn21htKB8whSCI755jd1EV0BMrDB0tyZBR6GbYIZACYOZA9Ub00KT0Mpvrc7hsVuiHGjkU1NvSjAO6iAUACxB2nhhqZBuyotCZCHvO7aZB4XYFbcPcdr5RijJNkZAzmB19RmKiJ9H8IwceoJaPSo1257geaEFVwZAqKsjrxnF',NULL),(2379359148770565,'WebhookTest123','850637388610185','EAALux5Ptc6QBAOhuYMcMJuZBxOjQyLd4MgtCwN9GmSRd3aQgcVVXutASPaubqLqTGQqZCRXu81nGZAFLKJygwJ3YymKzitgxk3JZAiU5uXqCWpFLKcA8EmxFXrDk4AcL4Cg6loJywfxAKBa5crqjOWw2E9qC9nvUqF68k6DDZBAZDZD',NULL);
/*!40000 ALTER TABLE `pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `templete`
--

DROP TABLE IF EXISTS `templete`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `templete` (
  `pageId` bigint(20) DEFAULT NULL,
  `position` smallint(4) DEFAULT NULL,
  `type` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `templateType` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `templateId` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `buttonId` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `templete`
--

LOCK TABLES `templete` WRITE;
/*!40000 ALTER TABLE `templete` DISABLE KEYS */;
/*!40000 ALTER TABLE `templete` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `user` (
  `id` bigint(255) NOT NULL,
  `name` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `accessToken` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `expiredTime` bigint(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (2379359148770565,'Wei-jhih Huang','t770324@hotmail.com','EAALux5Ptc6QBAAVnBtYJCzX6E6TB6Kuggef54XDnGBn6ImWB32sJiFkxHSqpOtk0vHsDi6TSthfJWou51BvKPGK4ZAkJR3U440Nf7tmcdgtE57OkWGAEoeqzyTt543IXfavLELlsYhCPaGqwL4U6s74PbHAgbUYZBLzOISpaxSCRMAXKY4B1y2ZApZCRlPZAPSGKF3t7ZAbQZDZD',1558333477331);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wellcomeMessage`
--

DROP TABLE IF EXISTS `wellcomeMessage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `wellcomeMessage` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `pageId` bigint(20) NOT NULL,
  `position` int(11) NOT NULL,
  `payload` varchar(45) NOT NULL,
  `info` json NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wellcomeMessage`
--

LOCK TABLES `wellcomeMessage` WRITE;
/*!40000 ALTER TABLE `wellcomeMessage` DISABLE KEYS */;
INSERT INTO `wellcomeMessage` VALUES (4,850637388610185,0,'getStarted','{\"attachment\": {\"type\": \"templete\", \"payload\": {\"text\": \"1\", \"buttons\": [{\"text\": \"2\", \"payload\": \"3\"}, {\"text\": \"4\", \"payload\": \"5\"}, {\"text\": \"6\", \"payload\": \"7\"}]}}}');
/*!40000 ALTER TABLE `wellcomeMessage` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-04-20 15:23:38
