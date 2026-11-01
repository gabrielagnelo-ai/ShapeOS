-- CreateTable
CREATE TABLE "diet_menus" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_menu_entries" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "diet_plan_id" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "diet_menu_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diet_menus_user_id_key" ON "diet_menus"("user_id");

-- CreateIndex
CREATE INDEX "diet_menu_entries_menu_id_order_idx" ON "diet_menu_entries"("menu_id", "order");

-- CreateIndex
CREATE INDEX "diet_menu_entries_diet_plan_id_idx" ON "diet_menu_entries"("diet_plan_id");

-- AddForeignKey
ALTER TABLE "diet_menus" ADD CONSTRAINT "diet_menus_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_menu_entries" ADD CONSTRAINT "diet_menu_entries_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "diet_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_menu_entries" ADD CONSTRAINT "diet_menu_entries_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
