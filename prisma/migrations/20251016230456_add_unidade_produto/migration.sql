-- AlterTable
ALTER TABLE `produto` ADD COLUMN `unidade` ENUM('UN', 'KG') NOT NULL DEFAULT 'UN';
