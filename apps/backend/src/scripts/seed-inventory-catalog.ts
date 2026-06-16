import "dotenv/config";
import { prisma } from "src/config/prisma";
import { INVENTORY_CATEGORY_SEED } from "src/services/inventory.catalog";

const main = async () => {
  for (const category of INVENTORY_CATEGORY_SEED) {
    const categoryRecord = await prisma.inventoryCategory.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        name: category.name,
        isMedical: category.isMedical,
        sortOrder: category.sortOrder,
      },
      update: {
        name: category.name,
        isMedical: category.isMedical,
        sortOrder: category.sortOrder,
      },
    });

    for (const [index, subcategory] of category.subcategories.entries()) {
      await prisma.inventorySubcategory.upsert({
        where: {
          categoryId_code: {
            categoryId: categoryRecord.id,
            code: subcategory.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
          },
        },
        create: {
          categoryId: categoryRecord.id,
          code: subcategory.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
          name: subcategory,
          sortOrder: index + 1,
          isActive: true,
        },
        update: {
          name: subcategory,
          sortOrder: index + 1,
          isActive: true,
        },
      });
    }
  }

  console.log("Inventory catalog seed complete.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
