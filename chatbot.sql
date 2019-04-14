create database chatbot;
--參數 id / name / email / accessToken
CREATE TABLE `chatbot`.`user` (
  `id` BIGINT(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `accessToken` VARCHAR(255) NULL,
  `expiredTime` INT NULL,
  PRIMARY KEY (`id`));

--
CREATE TABLE `chatbot`.`pages` (
  `id` BIGINT(255) NOT NULL,
  `accessToken` VARCHAR(255) NOT NULL,
  `pageName` VARCHAR(255) NOT NULL,
  `pageId` VARCHAR(255) NOT NULL);

--