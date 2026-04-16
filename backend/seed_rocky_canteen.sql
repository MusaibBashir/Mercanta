-- ============================================
-- Seed Data: Rocky Canteen (Single Franchise)
-- No admin account — uses existing admin as creator
-- Run this in Supabase SQL Editor AFTER migration.sql
-- ============================================

DO $$
DECLARE
    admin_id       UUID;
    rocky_id       UUID := gen_random_uuid();
BEGIN
    -- Get admin user (first admin in profiles)
    SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'No admin user found in profiles table. Please create an admin profile first.';
    END IF;

    RAISE NOTICE 'Using admin ID: %', admin_id;

    -- ========================================
    -- 1. Create Rocky Canteen Franchise
    -- ========================================
    INSERT INTO franchises (id, name, region, state, owner_id, created_by, is_active, created_at)
    VALUES (
        rocky_id,
        'Rocky Canteen',
        'North India',
        'Delhi',
        admin_id,
        admin_id,
        TRUE,
        NOW()
    );

    RAISE NOTICE 'Created franchise: Rocky Canteen (%)', rocky_id;

    -- ========================================
    -- 2. Inventory — Chips & Snacks
    -- ========================================
    INSERT INTO inventory (sku, barcode, item_name, category, price, quantity, description, franchise_id, date_added, last_updated)
    VALUES
        ('RCK-CHP-001', '8901491503542', 'Lays Classic Salted 26g',         'Chips & Snacks',  20,  150, 'Frito-Lay classic potato chips, salted flavour',                     rocky_id, NOW(), NOW()),
        ('RCK-CHP-002', '8901491504532', 'Lays American Style Cream & Onion 26g', 'Chips & Snacks', 20, 150, 'Frito-Lay cream & onion flavoured potato chips',                  rocky_id, NOW(), NOW()),
        ('RCK-CHP-003', '8901491505232', 'Lays Magic Masala 26g',            'Chips & Snacks',  20,  120, 'Frito-Lay tangy masala flavoured potato chips',                      rocky_id, NOW(), NOW()),
        ('RCK-CHP-004', '8901063147012', 'Kurkure Masala Munch 90g',         'Chips & Snacks',  30,  200, 'PepsiCo crunchy corn puffs with masala flavour',                     rocky_id, NOW(), NOW()),
        ('RCK-CHP-005', '8901063148019', 'Kurkure Chilli Chatka 90g',        'Chips & Snacks',  30,  180, 'PepsiCo crunchy corn puffs with chilli flavour',                     rocky_id, NOW(), NOW()),
        ('RCK-CHP-006', '8901063200014', 'Bingo Mad Angles Achaari Masti 65g','Chips & Snacks', 20,  160, 'ITC triangular chips with achaari masala',                           rocky_id, NOW(), NOW()),
        ('RCK-CHP-007', '8901063201011', 'Bingo Original Style Salted 45g',  'Chips & Snacks',  20,  140, 'ITC wavy potato chips, lightly salted',                              rocky_id, NOW(), NOW()),
        ('RCK-CHP-008', '8901764100019', 'Haldiram Aloo Bhujia 200g',        'Chips & Snacks',  80,   90, 'Haldirams crispy potato noodle snack',                               rocky_id, NOW(), NOW()),
        ('RCK-CHP-009', '8901764102013', 'Haldiram Moong Dal 200g',          'Chips & Snacks',  80,   80, 'Haldirams roasted & spiced moong dal',                               rocky_id, NOW(), NOW()),
        ('RCK-CHP-010', '8901764108015', 'Haldiram Mixture 200g',            'Chips & Snacks',  90,   70, 'Haldirams assorted savory snack mix',                                rocky_id, NOW(), NOW()),
        ('RCK-CHP-011', '8906062600011', 'Uncle Chips Spicy Treat 65g',      'Chips & Snacks',  30,  100, 'PepsiCo bold spicy flavoured potato chips',                          rocky_id, NOW(), NOW()),
        ('RCK-CHP-012', '8901063210013', 'Bingo Yumitos Chilli Sprinkled 52g','Chips & Snacks', 20,  120, 'ITC thin & crispy potato chips with chilli',                         rocky_id, NOW(), NOW());

    -- ========================================
    -- 3. Inventory — Chocolates
    -- ========================================
    INSERT INTO inventory (sku, barcode, item_name, category, price, quantity, description, franchise_id, date_added, last_updated)
    VALUES
        ('RCK-CHO-001', '7622201174941', 'Cadbury Dairy Milk 36g',           'Chocolates',  40,  200, 'Cadbury smooth & creamy milk chocolate bar',                          rocky_id, NOW(), NOW()),
        ('RCK-CHO-002', '7622201174958', 'Cadbury Dairy Milk Silk 60g',      'Chocolates',  80,  150, 'Cadbury premium smooth milk chocolate bar',                           rocky_id, NOW(), NOW()),
        ('RCK-CHO-003', '7622201174965', 'Cadbury Dairy Milk Roast Almond 36g','Chocolates',50,  120, 'Cadbury milk chocolate with roasted almonds',                          rocky_id, NOW(), NOW()),
        ('RCK-CHO-004', '7613034383389', 'KitKat 4 Finger 41.5g',            'Chocolates',  40,  180, 'Nestlé crispy wafer bar coated in milk chocolate',                    rocky_id, NOW(), NOW()),
        ('RCK-CHO-005', '7613035345942', 'KitKat Chunky 40g',                'Chocolates',  50,  140, 'Nestlé thick chunky wafer milk chocolate bar',                         rocky_id, NOW(), NOW()),
        ('RCK-CHO-006', '8901030858123', 'Nestlé Munch 8.4g',                'Chocolates',  10,  300, 'Nestlé crispy wafer fingers coated in chocolate',                     rocky_id, NOW(), NOW()),
        ('RCK-CHO-007', '8901030872113', 'Nestlé 5 Star 40g',                'Chocolates',  40,  200, 'Nestlé caramel & nougat bar covered in chocolate',                    rocky_id, NOW(), NOW()),
        ('RCK-CHO-008', '8901030862731', 'Nestlé Milkybar 30g',              'Chocolates',  30,  160, 'Nestlé smooth white chocolate bar for kids',                           rocky_id, NOW(), NOW()),
        ('RCK-CHO-009', '8901719100247', 'Amul Dark Chocolate 150g',         'Chocolates', 200,   80, 'Amul premium 55% cocoa dark chocolate',                               rocky_id, NOW(), NOW()),
        ('RCK-CHO-010', '8901719100261', 'Amul Milk Chocolate 150g',         'Chocolates', 190,   90, 'Amul creamy milk chocolate bar',                                      rocky_id, NOW(), NOW()),
        ('RCK-CHO-011', '3017620422003', 'Ferrero Rocher 3-Piece Box',       'Chocolates', 140,   60, 'Ferrero whole hazelnut in crunchy shell, premium gift box',            rocky_id, NOW(), NOW()),
        ('RCK-CHO-012', '7622201068715', 'Cadbury Gems 22g Tube',             'Chocolates',  20,  250, 'Cadbury mini sugar-coated chocolate buttons for kids',                rocky_id, NOW(), NOW()),
        ('RCK-CHO-013', '8901030862748', 'Nestlé Bar-One 55g',               'Chocolates',  40,  130, 'Nestlé caramel & nougat bar with milk chocolate coating',              rocky_id, NOW(), NOW());

    -- ========================================
    -- 4. Inventory — Biscuits & Cookies
    -- ========================================
    INSERT INTO inventory (sku, barcode, item_name, category, price, quantity, description, franchise_id, date_added, last_updated)
    VALUES
        ('RCK-BSC-001', '8901326100014', 'Parle-G Glucose Biscuits 799g',    'Biscuits & Cookies', 50,  200, 'Parle iconic wheat & milk glucose biscuits, family pack',            rocky_id, NOW(), NOW()),
        ('RCK-BSC-002', '8901326100021', 'Parle-G Glucose Biscuits 100g',    'Biscuits & Cookies', 10,  400, 'Parle iconic wheat & milk glucose biscuits, small pack',             rocky_id, NOW(), NOW()),
        ('RCK-BSC-003', '8901326200042', 'Parle Bourbon Cream 150g',          'Biscuits & Cookies', 25,  180, 'Parle chocolate cream sandwich biscuits',                            rocky_id, NOW(), NOW()),
        ('RCK-BSC-004', '8901326300031', 'Parle Monaco Salted 200g',          'Biscuits & Cookies', 30,  160, 'Parle thin & crispy salted crackers',                               rocky_id, NOW(), NOW()),
        ('RCK-BSC-005', '8901126100012', 'Britannia Marie Gold 250g',         'Biscuits & Cookies', 30,  200, 'Britannia light crispy tea biscuits',                               rocky_id, NOW(), NOW()),
        ('RCK-BSC-006', '8901126200010', 'Britannia Good Day Cashew 200g',    'Biscuits & Cookies', 35,  170, 'Britannia butter cookies with whole cashews',                        rocky_id, NOW(), NOW()),
        ('RCK-BSC-007', '8901126300018', 'Britannia Bourbon Cream 200g',      'Biscuits & Cookies', 35,  150, 'Britannia chocolate cream biscuit sandwich',                         rocky_id, NOW(), NOW()),
        ('RCK-BSC-008', '8901126400016', 'Britannia Hide & Seek 120g',        'Biscuits & Cookies', 40,  130, 'Britannia choco-chip cookies with dark chocolate chips',             rocky_id, NOW(), NOW()),
        ('RCK-BSC-009', '8901126500014', 'Britannia 50-50 Maska Chaska 200g', 'Biscuits & Cookies', 30,  160, 'Britannia sweet & salty puff biscuits',                             rocky_id, NOW(), NOW()),
        ('RCK-BSC-010', '8901126600012', 'Britannia Dark Fantasy Choco Fills 75g','Biscuits & Cookies',60, 100, 'Britannia premium cookies with dark chocolate centre filling',     rocky_id, NOW(), NOW()),
        ('RCK-BSC-011', '8901571100017', 'Sunfeast Yippee Magic Masala Biscuit 62g','Biscuits & Cookies',20, 140, 'ITC Sunfeast masala-flavoured salty biscuits',                  rocky_id, NOW(), NOW()),
        ('RCK-BSC-012', '8901571200015', 'Sunfeast Farmlite Oats & Raisin 75g','Biscuits & Cookies', 45, 100, 'ITC multigrain oat cookies with raisins, digestive',               rocky_id, NOW(), NOW()),
        ('RCK-BSC-013', '8901326400028', 'Parle Hide & Seek Fab 112g',        'Biscuits & Cookies', 40,  110, 'Parle chocolate chip cookies with cocoa dough',                     rocky_id, NOW(), NOW());

    -- ========================================
    -- Done!
    -- ========================================
    RAISE NOTICE '✅ Rocky Canteen seed complete!';
    RAISE NOTICE '   Franchise: Rocky Canteen (%), Region: North India, Delhi', rocky_id;
    RAISE NOTICE '   Chips & Snacks: 12 items';
    RAISE NOTICE '   Chocolates: 13 items';
    RAISE NOTICE '   Biscuits & Cookies: 13 items';
    RAISE NOTICE '   Total: 38 inventory items added';

END $$;

-- ============================================
-- Verify: Summary of Rocky Canteen inventory
-- ============================================
SELECT
    f.name                          AS franchise,
    i.category,
    COUNT(*)                        AS items,
    SUM(i.quantity)                 AS total_units,
    MIN(i.price)                    AS min_price,
    MAX(i.price)                    AS max_price
FROM inventory i
JOIN franchises f ON f.id = i.franchise_id
WHERE f.name = 'Rocky Canteen'
GROUP BY f.name, i.category
ORDER BY i.category;
