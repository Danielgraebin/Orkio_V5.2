CREATE TABLE `agent_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentAgentId` int NOT NULL,
	`childAgentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_links_id` PRIMARY KEY(`id`)
);
