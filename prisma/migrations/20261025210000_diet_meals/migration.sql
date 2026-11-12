-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('NORMAL', 'SOFT', 'LIQUID', 'CLEAR_LIQUID', 'DIABETIC', 'LOW_SALT', 'RENAL', 'HIGH_PROTEIN', 'NIL_BY_MOUTH');

-- CreateEnum
CREATE TYPE "Meal" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER');

-- CreateEnum
CREATE TYPE "MealOrderStatus" AS ENUM ('ORDERED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MealIntake" AS ENUM ('FULL', 'HALF', 'LITTLE', 'NONE');

-- AlterEnum
ALTER TYPE "ChargeCategory" ADD VALUE 'DIETARY';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KITCHEN';

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "dietNotes" TEXT,
ADD COLUMN     "dietType" "DietType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "dietUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "dietUpdatedById" TEXT;

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meal" "Meal" NOT NULL,
    "diets" "DietType"[],
    "vegetarian" BOOLEAN NOT NULL DEFAULT true,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOrder" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "meal" "Meal" NOT NULL,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "status" "MealOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "byPatient" BOOLEAN NOT NULL DEFAULT false,
    "orderedById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveredById" TEXT,
    "intake" "MealIntake",
    "intakeRecordedById" TEXT,
    "intakeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_name_meal_key" ON "MenuItem"("name", "meal");

-- CreateIndex
CREATE INDEX "MealOrder_date_meal_idx" ON "MealOrder"("date", "meal");

-- CreateIndex
CREATE UNIQUE INDEX "MealOrder_admissionId_date_meal_key" ON "MealOrder"("admissionId", "date", "meal");

-- AddForeignKey
ALTER TABLE "MealOrder" ADD CONSTRAINT "MealOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter menu (edit in Kitchen → Menu). Regular dishes are included in the room rate; extras are charged.
INSERT INTO "MenuItem" ("id", "name", "meal", "diets", "vegetarian", "isExtra", "price", "description", "active", "createdAt", "updatedAt") VALUES
  ('menu_b_idli',    'Idli with sambar',          'BREAKFAST', ARRAY['NORMAL','SOFT','DIABETIC','LOW_SALT','RENAL']::"DietType"[], true, false, 0, '3 idli, sambar, coconut chutney', true, now(), now()),
  ('menu_b_upma',    'Vegetable upma',            'BREAKFAST', ARRAY['NORMAL','DIABETIC','LOW_SALT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_b_poha',    'Poha',                      'BREAKFAST', ARRAY['NORMAL','LOW_SALT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_b_oats',    'Oats porridge',             'BREAKFAST', ARRAY['NORMAL','SOFT','DIABETIC','LOW_SALT','RENAL','HIGH_PROTEIN']::"DietType"[], true, false, 0, 'Made with milk, no sugar for diabetic diet', true, now(), now()),
  ('menu_b_eggs',    'Boiled eggs (2)',           'BREAKFAST', ARRAY['NORMAL','DIABETIC','HIGH_PROTEIN']::"DietType"[], false, false, 0, NULL, true, now(), now()),
  ('menu_b_milk',    'Warm milk',                 'BREAKFAST', ARRAY['NORMAL','SOFT','LIQUID','HIGH_PROTEIN','LOW_SALT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_b_kanji',   'Rice kanji',                'BREAKFAST', ARRAY['LIQUID','SOFT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_b_coconut', 'Tender coconut water',      'BREAKFAST', ARRAY['CLEAR_LIQUID','LIQUID','NORMAL']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_l_thali',   'Veg thali (dal, rice, sabzi, 2 roti)', 'LUNCH', ARRAY['NORMAL','LOW_SALT','HIGH_PROTEIN']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_l_diab',    'Diabetic thali',            'LUNCH', ARRAY['DIABETIC']::"DietType"[], true, false, 0, 'Multigrain roti, dal, salad, no rice', true, now(), now()),
  ('menu_l_khichdi', 'Moong dal khichdi with curd','LUNCH', ARRAY['NORMAL','SOFT','LOW_SALT','RENAL']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_l_chicken', 'Chicken curry with rice',   'LUNCH', ARRAY['NORMAL','HIGH_PROTEIN']::"DietType"[], false, false, 0, NULL, true, now(), now()),
  ('menu_l_curdrice','Curd rice',                 'LUNCH', ARRAY['NORMAL','SOFT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_l_dalsoup', 'Dal soup',                  'LUNCH', ARRAY['LIQUID','SOFT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_l_clear',   'Clear vegetable soup',      'LUNCH', ARRAY['CLEAR_LIQUID','LIQUID','SOFT','NORMAL','RENAL']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_s_fruit',   'Fruit bowl',                'SNACKS', ARRAY['NORMAL','LOW_SALT','HIGH_PROTEIN','SOFT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_s_sprouts', 'Sprouts salad',             'SNACKS', ARRAY['NORMAL','DIABETIC','HIGH_PROTEIN','LOW_SALT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_s_buttermilk','Buttermilk',              'SNACKS', ARRAY['NORMAL','LIQUID','SOFT','DIABETIC']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_s_tea',     'Tea with marie biscuits',   'SNACKS', ARRAY['NORMAL','LOW_SALT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_s_juice',   'Strained apple juice',      'SNACKS', ARRAY['CLEAR_LIQUID','LIQUID']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_d_roti',    'Roti, dal and sabzi',       'DINNER', ARRAY['NORMAL','DIABETIC','LOW_SALT','HIGH_PROTEIN']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_d_khichdi', 'Vegetable khichdi',         'DINNER', ARRAY['NORMAL','SOFT','LOW_SALT','RENAL']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_d_paneer',  'Paneer curry with roti',    'DINNER', ARRAY['NORMAL','HIGH_PROTEIN']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_d_fish',    'Fish curry with rice',      'DINNER', ARRAY['NORMAL','HIGH_PROTEIN']::"DietType"[], false, false, 0, NULL, true, now(), now()),
  ('menu_d_soup',    'Clear chicken soup',        'DINNER', ARRAY['CLEAR_LIQUID','LIQUID','SOFT','NORMAL']::"DietType"[], false, false, 0, NULL, true, now(), now()),
  ('menu_d_kanji',   'Rice kanji',                'DINNER', ARRAY['LIQUID','SOFT']::"DietType"[], true, false, 0, NULL, true, now(), now()),
  ('menu_x_juice',   'Fresh lime juice',          'LUNCH', ARRAY['NORMAL','LIQUID','LOW_SALT']::"DietType"[], true, true, 60, 'Extra — charged to bill', true, now(), now()),
  ('menu_x_chai',    'Masala chai',               'SNACKS', ARRAY['NORMAL','LOW_SALT','SOFT']::"DietType"[], true, true, 20, 'Extra — charged to bill', true, now(), now()),
  ('menu_x_roti',    'Extra roti (2)',            'DINNER', ARRAY['NORMAL','HIGH_PROTEIN','LOW_SALT','DIABETIC']::"DietType"[], true, true, 30, 'Extra — charged to bill', true, now(), now()),
  ('menu_x_coconut', 'Tender coconut',            'SNACKS', ARRAY['NORMAL','LIQUID','CLEAR_LIQUID']::"DietType"[], true, true, 50, 'Extra — charged to bill', true, now(), now())
ON CONFLICT ("name", "meal") DO NOTHING;
