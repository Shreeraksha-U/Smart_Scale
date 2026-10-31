// --- State & Unit Conversion Factors ---
        let currentCurrency = '₹';
        let currentMode = 'proportional'; // 'proportional' | 'compare'
        let lastEditedTarget = 'weight';  // 'weight' | 'price'
        let savedItems = [];

        // Conversion factors to base unit:
        // Weight base: Grams (g)
        // Volume base: Milliliters (ml)
        // Count base: Pieces (pcs)
        const UNIT_META = {
            g:   { label: 'g',   name: 'Grams',       category: 'Weight', factor: 1 },
            kg:  { label: 'kg',  name: 'Kilograms',   category: 'Weight', factor: 1000 },
            mg:  { label: 'mg',  name: 'Milligrams',  category: 'Weight', factor: 0.001 },
            oz:  { label: 'oz',  name: 'Ounces',      category: 'Weight', factor: 28.349523125 },
            lb:  { label: 'lb',  name: 'Pounds',      category: 'Weight', factor: 453.59237 },
            ml:  { label: 'ml',  name: 'Milliliters', category: 'Volume', factor: 1 },
            l:   { label: 'L',   name: 'Liters',      category: 'Volume', factor: 1000 },
            pcs: { label: 'pcs', name: 'Pieces',      category: 'Count',  factor: 1 }
        };

        // Format numbers cleanly without trailing zeros
        function formatNumber(num, maxDecimals = 2) {
            if (!isFinite(num) || isNaN(num)) return '0';
            if (num === 0) return '0';
            // For very small numbers, show up to 4 decimals
            if (Math.abs(num) > 0 && Math.abs(num) < 0.01) {
                return parseFloat(num.toFixed(4)).toString();
            }
            return parseFloat(num.toFixed(maxDecimals)).toLocaleString('en-US', {
                maximumFractionDigits: maxDecimals
            });
        }

        // Plain float formatting for input values (no commas so type="number" works)
        function formatInputVal(num, maxDecimals = 3) {
            if (!isFinite(num) || isNaN(num) || num < 0) return '';
            return parseFloat(num.toFixed(maxDecimals));
        }

        // Convert any unit to normalized base (grams for weight, ml for volume, pcs for count)
        // Note: if mixing Weight and Volume (e.g., g and ml), we treat 1g ≈ 1ml water equivalent so users never get stuck
        function toBaseQuantity(amount, unitKey) {
            const unit = UNIT_META[unitKey] || UNIT_META.g;
            return amount * unit.factor;
        }

        function fromBaseQuantity(baseAmount, unitKey) {
            const unit = UNIT_META[unitKey] || UNIT_META.g;
            return baseAmount / unit.factor;
        }

        // --- Currency Management ---
        function setCurrency(symbol) {
            currentCurrency = symbol;
            document.querySelectorAll('.curr-symbol').forEach(el => {
                el.textContent = symbol;
            });
            document.querySelectorAll('.curr-btn').forEach(btn => {
                if (btn.id === `curr-${symbol}`) {
                    btn.className = 'curr-btn px-2.5 py-1 text-xs font-bold rounded-lg transition-all bg-indigo-600 text-white shadow-xs';
                } else {
                    btn.className = 'curr-btn px-2.5 py-1 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
                }
            });
            calculateProportional('base');
            calculateComparison();
            renderSavedList();
        }

        // --- Mode Switching ---
        function switchMode(mode) {
            currentMode = mode;
            const secProp = document.getElementById('section-proportional');
            const secComp = document.getElementById('section-compare');
            const tabProp = document.getElementById('tab-proportional');
            const tabComp = document.getElementById('tab-compare');

            if (mode === 'proportional') {
                secProp.classList.remove('hidden');
                secComp.classList.add('hidden');
                tabProp.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm';
                tabComp.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
                calculateProportional('base');
            } else {
                secProp.classList.add('hidden');
                secComp.classList.remove('hidden');
                tabComp.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm';
                tabProp.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
                calculateComparison();
            }
        }

        // --- Handle Unit Dropdown Changes ---
        function handleUnitChange(source) {
            const baseUnit = document.getElementById('base-unit').value;
            const unitMeta = UNIT_META[baseUnit];
            document.getElementById('unit-type-badge').textContent = `${unitMeta.category} (${unitMeta.name})`;

            if (source === 'base') {
                calculateProportional('base');
            } else {
                // When user changes target unit, recalculate based on last edited target field
                calculateProportional(lastEditedTarget);
            }
        }

        // --- Core Bidirectional Proportional Calculator ---
        function calculateProportional(trigger) {
            const baseName = document.getElementById('base-name').value.trim() || 'Product';
            const baseWeightInput = parseFloat(document.getElementById('base-weight').value);
            const baseUnit = document.getElementById('base-unit').value;
            const basePriceInput = parseFloat(document.getElementById('base-price').value);

            const targetWeightEl = document.getElementById('target-weight');
            const targetUnit = document.getElementById('target-unit').value;
            const targetPriceEl = document.getElementById('target-price');

            const weightBox = document.getElementById('target-weight-box');
            const priceBox = document.getElementById('target-price-box');
            const weightTag = document.getElementById('weight-status-tag');
            const priceTag = document.getElementById('price-status-tag');
            const dirBadge = document.getElementById('calc-direction-badge');

            document.getElementById('cheat-sheet-product-title').textContent = baseName;

            // Validate base product
            if (isNaN(baseWeightInput) || baseWeightInput <= 0 || isNaN(basePriceInput) || basePriceInput < 0) {
                document.getElementById('proportional-summary').innerHTML = `Please enter a valid weight and price for <strong>${baseName}</strong> to calculate rates.`;
                document.getElementById('base-rate-pills').innerHTML = `<div class="col-span-3 text-xs text-slate-400 py-2">Waiting for valid base weight & price...</div>`;
                document.getElementById('quick-reference-grid').innerHTML = '';
                return;
            }

            const baseNormQty = toBaseQuantity(baseWeightInput, baseUnit); // in grams/ml/pcs
            const pricePerBaseUnit = basePriceInput / baseNormQty; // price per 1g / 1ml / 1pc

            // Determine calculation direction
            if (trigger === 'weight') {
                lastEditedTarget = 'weight';
            } else if (trigger === 'price') {
                lastEditedTarget = 'price';
            }

            let targetWeightVal = parseFloat(targetWeightEl.value);
            let targetPriceVal = parseFloat(targetPriceEl.value);

            if (lastEditedTarget === 'weight') {
                // User edited Target Weight -> Calculate Target Price
                dirBadge.textContent = 'Weight ➔ Price';
                weightTag.textContent = 'You Entered';
                weightTag.className = 'text-[11px] font-bold text-indigo-600 dark:text-indigo-400';
                priceTag.textContent = 'Auto-Calculated Cost';
                priceTag.className = 'text-[11px] font-bold text-emerald-600 dark:text-emerald-400';

                weightBox.className = 'p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border-2 border-indigo-500/60 transition-all';
                priceBox.className = 'p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 transition-all';

                if (!isNaN(targetWeightVal) && targetWeightVal >= 0) {
                    const targetNormQty = toBaseQuantity(targetWeightVal, targetUnit);
                    const calculatedPrice = targetNormQty * pricePerBaseUnit;
                    targetPriceEl.value = formatInputVal(calculatedPrice, 2);
                    targetPriceVal = calculatedPrice;
                } else {
                    targetPriceEl.value = '';
                }
            } else {
                // User edited Target Price -> Calculate Target Weight
                dirBadge.textContent = 'Price ➔ Weight';
                priceTag.textContent = 'You Entered Budget';
                priceTag.className = 'text-[11px] font-bold text-emerald-600 dark:text-emerald-400';
                weightTag.textContent = 'Auto-Calculated Weight';
                weightTag.className = 'text-[11px] font-bold text-indigo-600 dark:text-indigo-400';

                priceBox.className = 'p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border-2 border-emerald-500/60 transition-all';
                weightBox.className = 'p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 transition-all';

                if (!isNaN(targetPriceVal) && targetPriceVal >= 0 && pricePerBaseUnit > 0) {
                    const affordableNormQty = targetPriceVal / pricePerBaseUnit;
                    const calculatedWeight = fromBaseQuantity(affordableNormQty, targetUnit);
                    targetWeightEl.value = formatInputVal(calculatedWeight, 3);
                    targetWeightVal = calculatedWeight;
                } else if (pricePerBaseUnit === 0) {
                    targetWeightEl.value = 0;
                } else {
                    targetWeightEl.value = '';
                }
            }

            // Update Summary Sentence
            const summaryEl = document.getElementById('proportional-summary');
            const tUnitLabel = UNIT_META[targetUnit].label;
            const bUnitLabel = UNIT_META[baseUnit].label;

            if (!isNaN(targetWeightVal) && !isNaN(targetPriceVal)) {
                if (lastEditedTarget === 'weight') {
                    summaryEl.innerHTML = `If <strong>${formatNumber(baseWeightInput)}${bUnitLabel}</strong> of <strong>${baseName}</strong> costs <strong>${currentCurrency}${formatNumber(basePriceInput)}</strong>, then <strong>${formatNumber(targetWeightVal, 3)}${tUnitLabel}</strong> will cost <span class="underline decoration-2 underline-offset-4 font-extrabold text-amber-200">${currentCurrency}${formatNumber(targetPriceVal, 2)}</span>.`;
                } else {
                    summaryEl.innerHTML = `At <strong>${currentCurrency}${formatNumber(basePriceInput)}</strong> per <strong>${formatNumber(baseWeightInput)}${bUnitLabel}</strong>, for <span class="underline decoration-2 underline-offset-4 font-extrabold text-amber-200">${currentCurrency}${formatNumber(targetPriceVal, 2)}</span> you will get <strong>${formatNumber(targetWeightVal, 3)}${tUnitLabel}</strong> of <strong>${baseName}</strong>.`;
                }
            } else {
                summaryEl.innerHTML = `Enter any target weight or budget price above to see the instant calculation.`;
            }

            // Render Base Unit Breakdown Pills & Quick Reference Grid
            renderBaseRatePills(pricePerBaseUnit, baseUnit);
            renderQuickReferenceGrid(pricePerBaseUnit, baseUnit);
        }

        function renderBaseRatePills(pricePerBaseUnit, baseUnit) {
            const container = document.getElementById('base-rate-pills');
            const category = UNIT_META[baseUnit].category;

            let pills = [];
            if (category === 'Weight') {
                pills = [
                    { label: 'Per 1g',   cost: pricePerBaseUnit * 1 },
                    { label: 'Per 100g', cost: pricePerBaseUnit * 100 },
                    { label: 'Per 1kg',  cost: pricePerBaseUnit * 1000 }
                ];
            } else if (category === 'Volume') {
                pills = [
                    { label: 'Per 1ml',   cost: pricePerBaseUnit * 1 },
                    { label: 'Per 100ml', cost: pricePerBaseUnit * 100 },
                    { label: 'Per 1 Liter', cost: pricePerBaseUnit * 1000 }
                ];
            } else {
                pills = [
                    { label: 'Per 1 pc',   cost: pricePerBaseUnit * 1 },
                    { label: 'Per 10 pcs', cost: pricePerBaseUnit * 10 },
                    { label: 'Per 12 (Dozen)', cost: pricePerBaseUnit * 12 }
                ];
            }

            container.innerHTML = pills.map(p => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70">
                    <div class="text-[11px] text-slate-400 font-medium">${p.label}</div>
                    <div class="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">${currentCurrency}${formatNumber(p.cost, 2)}</div>
                </div>
            `).join('');
        }

        function renderQuickReferenceGrid(pricePerBaseUnit, baseUnit) {
            const grid = document.getElementById('quick-reference-grid');
            const category = UNIT_META[baseUnit].category;

            let presets = [];
            if (category === 'Weight') {
                presets = [
                    { qty: 50,  unit: 'g',  label: '50g' },
                    { qty: 100, unit: 'g',  label: '100g' },
                    { qty: 250, unit: 'g',  label: '250g' },
                    { qty: 500, unit: 'g',  label: '500g' },
                    { qty: 1,   unit: 'kg', label: '1 kg' },
                    { qty: 1,   unit: 'lb', label: '1 lb (Pound)' }
                ];
            } else if (category === 'Volume') {
                presets = [
                    { qty: 50,  unit: 'ml', label: '50 ml' },
                    { qty: 100, unit: 'ml', label: '100 ml' },
                    { qty: 250, unit: 'ml', label: '250 ml' },
                    { qty: 500, unit: 'ml', label: '500 ml' },
                    { qty: 1,   unit: 'l',  label: '1 Liter' },
                    { qty: 2,   unit: 'l',  label: '2 Liters' }
                ];
            } else {
                presets = [
                    { qty: 1,   unit: 'pcs', label: '1 pc' },
                    { qty: 2,   unit: 'pcs', label: '2 pcs' },
                    { qty: 5,   unit: 'pcs', label: '5 pcs' },
                    { qty: 10,  unit: 'pcs', label: '10 pcs' },
                    { qty: 12,  unit: 'pcs', label: '12 pcs' },
                    { qty: 50,  unit: 'pcs', label: '50 pcs' }
                ];
            }

            grid.innerHTML = presets.map(item => {
                const norm = toBaseQuantity(item.qty, item.unit);
                const cost = norm * pricePerBaseUnit;
                return `
                    <button onclick="setTargetPresetWeight(${item.qty}, '${item.unit}')" 
                        class="text-left p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-800/60 dark:hover:bg-indigo-950/50 border border-slate-200/80 dark:border-slate-700/80 transition group">
                        <div class="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                            <span>${item.label}</span>
                            <i class="ph ph-arrow-up-right opacity-0 group-hover:opacity-100 transition"></i>
                        </div>
                        <div class="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1">
                            ${currentCurrency}${formatNumber(cost, 2)}
                        </div>
                    </button>
                `;
            }).join('');
        }

        // --- Preset Chip Helpers ---
        function setBaseWeight(weight, unit) {
            document.getElementById('base-weight').value = weight;
            document.getElementById('base-unit').value = unit;
            handleUnitChange('base');
        }

        function setTargetPresetWeight(weight, unit) {
            document.getElementById('target-weight').value = weight;
            document.getElementById('target-unit').value = unit;
            calculateProportional('weight');
        }

        function setTargetPresetPrice(price) {
            document.getElementById('target-price').value = price;
            calculateProportional('price');
        }

        function loadSoapExample() {
            switchMode('proportional');
            document.getElementById('base-name').value = 'Bath Soap (50g)';
            document.getElementById('base-weight').value = 50;
            document.getElementById('base-unit').value = 'g';
            document.getElementById('base-price').value = 35;

            document.getElementById('target-weight').value = 125;
            document.getElementById('target-unit').value = 'g';
            calculateProportional('weight');
            showToast('Loaded 50g Soap Demo!');
        }

        // --- Mode 2: Head-to-Head Product Comparison Logic ---
        function handleCompareUnitChange(prod) {
            calculateComparison();
        }

        function calculateComparison() {
            const nameA = document.getElementById('comp-a-name').value.trim() || 'Product A';
            const weightA = parseFloat(document.getElementById('comp-a-weight').value);
            const unitA = document.getElementById('comp-a-unit').value;
            const priceA = parseFloat(document.getElementById('comp-a-price').value);

            const nameB = document.getElementById('comp-b-name').value.trim() || 'Product B';
            const weightB = parseFloat(document.getElementById('comp-b-weight').value);
            const unitB = document.getElementById('comp-b-unit').value;
            const priceB = parseFloat(document.getElementById('comp-b-price').value);

            const cardA = document.getElementById('card-prod-a');
            const cardB = document.getElementById('card-prod-b');
            const badgeA = document.getElementById('badge-winner-a');
            const badgeB = document.getElementById('badge-winner-b');
            const headline = document.getElementById('verdict-headline');
            const subtext = document.getElementById('verdict-subtext');

            if (isNaN(weightA) || weightA <= 0 || isNaN(priceA) || priceA < 0 ||
                isNaN(weightB) || weightB <= 0 || isNaN(priceB) || priceB < 0) {
                headline.textContent = 'Enter weight and price for both products';
                subtext.textContent = 'Fill out all fields above to see which offer gives you more value for your money.';
                badgeA.classList.add('hidden');
                badgeB.classList.add('hidden');
                return;
            }

            const normA = toBaseQuantity(weightA, unitA);
            const normB = toBaseQuantity(weightB, unitB);

            const unitRateA = priceA / normA; // per 1g / 1ml
            const unitRateB = priceB / normB;

            // What would Product B cost if it had Product A's weight?
            const bAtAWeight = unitRateB * normA;
            // What would Product A cost if it had Product B's weight?
            const aAtBWeight = unitRateA * normB;

            // Populate Metrics inside Cards
            document.getElementById('comp-a-metrics').innerHTML = `
                <div class="flex justify-between"><span>Per 100g / 100ml:</span><strong class="text-slate-900 dark:text-white">${currentCurrency}${formatNumber(unitRateA * 100, 2)}</strong></div>
                <div class="flex justify-between"><span>Per 1kg / 1L:</span><strong class="text-slate-900 dark:text-white">${currentCurrency}${formatNumber(unitRateA * 1000, 2)}</strong></div>
                <div class="flex justify-between text-indigo-600 dark:text-indigo-400 pt-1">
                    <span>Cost for ${formatNumber(weightB)}${unitB} at this rate:</span>
                    <strong>${currentCurrency}${formatNumber(aAtBWeight, 2)}</strong>
                </div>
            `;

            document.getElementById('comp-b-metrics').innerHTML = `
                <div class="flex justify-between"><span>Per 100g / 100ml:</span><strong class="text-slate-900 dark:text-white">${currentCurrency}${formatNumber(unitRateB * 100, 2)}</strong></div>
                <div class="flex justify-between"><span>Per 1kg / 1L:</span><strong class="text-slate-900 dark:text-white">${currentCurrency}${formatNumber(unitRateB * 1000, 2)}</strong></div>
                <div class="flex justify-between text-purple-600 dark:text-purple-400 pt-1">
                    <span>Cost for ${formatNumber(weightA)}${unitA} at this rate:</span>
                    <strong>${currentCurrency}${formatNumber(bAtAWeight, 2)}</strong>
                </div>
            `;

            // Determine Winner
            const epsilon = 0.000001;
            if (Math.abs(unitRateA - unitRateB) < epsilon) {
                badgeA.classList.add('hidden');
                badgeB.classList.add('hidden');
                cardA.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-all relative overflow-hidden';
                cardB.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-all relative overflow-hidden';
                headline.textContent = `It's a Tie! Both products cost the exact same per unit.`;
                subtext.textContent = `Both ${nameA} and ${nameB} cost ${currentCurrency}${formatNumber(unitRateA * 100, 2)} per 100 units.`;
            } else if (unitRateA < unitRateB) {
                // Product A is cheaper
                const savingsPct = ((unitRateB - unitRateA) / unitRateB) * 100;
                const savingsOnBWeight = priceB - aAtBWeight;
                badgeA.classList.remove('hidden');
                badgeB.classList.add('hidden');
                cardA.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500 p-5 sm:p-6 shadow-md transition-all relative overflow-hidden';
                cardB.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs opacity-90 transition-all relative overflow-hidden';

                headline.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400">${nameA}</span> is <strong>${formatNumber(savingsPct, 1)}% cheaper</strong> per unit!`;
                subtext.innerHTML = `Buying ${formatNumber(weightB)}${unitB} at ${nameA}'s rate would only cost <strong>${currentCurrency}${formatNumber(aAtBWeight, 2)}</strong> instead of ${currentCurrency}${formatNumber(priceB, 2)} (You save <strong>${currentCurrency}${formatNumber(savingsOnBWeight, 2)}</strong>).`;
            } else {
                // Product B is cheaper
                const savingsPct = ((unitRateA - unitRateB) / unitRateA) * 100;
                const savingsOnBWeight = aAtBWeight - priceB;
                badgeB.classList.remove('hidden');
                badgeA.classList.add('hidden');
                cardB.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500 p-5 sm:p-6 shadow-md transition-all relative overflow-hidden';
                cardA.className = 'bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs opacity-90 transition-all relative overflow-hidden';

                headline.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400">${nameB}</span> is <strong>${formatNumber(savingsPct, 1)}% cheaper</strong> per unit!`;
                subtext.innerHTML = `For ${formatNumber(weightB)}${unitB}, you pay <strong>${currentCurrency}${formatNumber(priceB, 2)}</strong> instead of ${currentCurrency}${formatNumber(aAtBWeight, 2)} at ${nameA}'s rate (You save <strong>${currentCurrency}${formatNumber(savingsOnBWeight, 2)}</strong>).`;
            }
        }

    document.addEventListener('wheel', function (event) {
    if (document.activeElement?.type === 'number') {
        document.activeElement.blur();
    }
    }, { passive: true });

        // --- History / Saved List ---
        function saveCurrentCalculation(mode) {
            if (mode === 'proportional') {
                const name = document.getElementById('base-name').value.trim() || 'Product';
                const bW = parseFloat(document.getElementById('base-weight').value);
                const bU = document.getElementById('base-unit').value;
                const bP = parseFloat(document.getElementById('base-price').value);
                const tW = parseFloat(document.getElementById('target-weight').value);
                const tU = document.getElementById('target-unit').value;
                const tP = parseFloat(document.getElementById('target-price').value);

                if (isNaN(bW) || isNaN(bP) || isNaN(tW) || isNaN(tP)) return;

                savedItems.unshift({
                    id: Date.now(),
                    type: 'Proportional',
                    title: name,
                    detail: `Base: ${formatNumber(bW)}${bU} = ${currentCurrency}${formatNumber(bP)} ➔ Target: ${formatNumber(tW, 3)}${tU} = ${currentCurrency}${formatNumber(tP, 2)}`,
                    badge: `${currentCurrency}${formatNumber(tP, 2)} for ${formatNumber(tW, 2)}${tU}`
                });
            } else {
                const nameA = document.getElementById('comp-a-name').value.trim() || 'Product A';
                const wA = parseFloat(document.getElementById('comp-a-weight').value);
                const uA = document.getElementById('comp-a-unit').value;
                const pA = parseFloat(document.getElementById('comp-a-price').value);

                const nameB = document.getElementById('comp-b-name').value.trim() || 'Product B';
                const wB = parseFloat(document.getElementById('comp-b-weight').value);
                const uB = document.getElementById('comp-b-unit').value;
                const pB = parseFloat(document.getElementById('comp-b-price').value);

                if (isNaN(wA) || isNaN(pA) || isNaN(wB) || isNaN(pB)) return;

                const rateA = pA / toBaseQuantity(wA, uA);
                const rateB = pB / toBaseQuantity(wB, uB);
                const winner = rateA < rateB ? nameA : (rateB < rateA ? nameB : 'Tie');

                savedItems.unshift({
                    id: Date.now(),
                    type: 'Comparison',
                    title: `${nameA} vs ${nameB}`,
                    detail: `${formatNumber(wA)}${uA} (${currentCurrency}${formatNumber(pA)}) vs ${formatNumber(wB)}${uB} (${currentCurrency}${formatNumber(pB)})`,
                    badge: `Winner: ${winner}`
                });
            }

            renderSavedList();
            showToast('Saved to shopping log!');
        }

        function removeSavedItem(id) {
            savedItems = savedItems.filter(item => item.id !== id);
            renderSavedList();
        }

        function clearHistory() {
            savedItems = [];
            renderSavedList();
            showToast('Cleared saved history');
        }

        function renderSavedList() {
            const emptyState = document.getElementById('saved-list-empty');
            const listContainer = document.getElementById('saved-list-container');
            const countBadge = document.getElementById('saved-count');
            const clearBtn = document.getElementById('clear-history-btn');

            countBadge.textContent = savedItems.length;

            if (savedItems.length === 0) {
                emptyState.classList.remove('hidden');
                listContainer.classList.add('hidden');
                clearBtn.classList.add('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            listContainer.classList.remove('hidden');
            clearBtn.classList.remove('hidden');

            listContainer.innerHTML = savedItems.map(item => `
                <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="space-y-0.5">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${item.type === 'Proportional' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400'}">${item.type}</span>
                            <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">${item.title}</span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${item.detail}</p>
                    </div>
                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                        <span class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                            ${item.badge}
                        </span>
                        <button onclick="removeSavedItem(${item.id})" class="p-1.5 text-slate-400 hover:text-rose-500 transition" title="Remove">
                            <i class="ph-bold ph-x text-sm"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // --- Theme & Toast Utilities ---
        function toggleTheme() {
            const html = document.documentElement;
            const icon = document.getElementById('theme-icon');
            html.classList.toggle('dark');
            if (html.classList.contains('dark')) {
                icon.className = 'ph-bold ph-sun text-base text-amber-400';
            } else {
                icon.className = 'ph-bold ph-moon text-base';
            }
        }

        let toastTimeout;
        function showToast(message) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-msg').textContent = message;
            toast.classList.remove('translate-y-20', 'opacity-0');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 2400);
        }

        // Initialize App on Load
        window.onload = function () {
            setCurrency('₹');
            calculateProportional('weight');
            calculateComparison();
        };
