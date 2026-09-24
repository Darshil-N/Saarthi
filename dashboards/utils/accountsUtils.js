import { purchases, materials, vendors } from '../data/mockAccountsData';

export const formatINR = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

export const getMaterialById = (id) => materials.find((m) => m.id === id);
export const getVendorById = (id) => vendors.find((v) => v.id === id);

export const getMaterialVendorStats = (materialId) => {
  const materialPurchases = purchases.filter((p) => p.materialId === materialId);
  const vendorMap = {};

  materialPurchases.forEach((p) => {
    if (!vendorMap[p.vendorId]) {
      vendorMap[p.vendorId] = {
        vendorId: p.vendorId,
        vendorName: p.vendorName,
        purchases: 0,
        totalQuantity: 0,
        totalValue: 0,
        minPrice: p.unitPrice,
        maxPrice: p.unitPrice,
        lastPrice: p.unitPrice,
        lastPurchaseDate: p.date,
        qualityA: 0,
      };
    }
    const vStats = vendorMap[p.vendorId];
    vStats.purchases += 1;
    vStats.totalQuantity += p.quantity;
    vStats.totalValue += p.totalValue;
    if (p.unitPrice < vStats.minPrice) vStats.minPrice = p.unitPrice;
    if (p.unitPrice > vStats.maxPrice) vStats.maxPrice = p.unitPrice;
    
    // Assumes purchases are pre-sorted descending by date
    if (new Date(p.date) > new Date(vStats.lastPurchaseDate)) {
      vStats.lastPrice = p.unitPrice;
      vStats.lastPurchaseDate = p.date;
    }
    if (p.quality === 'A') vStats.qualityA += 1;
  });

  return Object.values(vendorMap).map((v) => ({
    ...v,
    avgPrice: v.totalValue / v.totalQuantity,
    qualityPercent: Math.round((v.qualityA / v.purchases) * 100),
  }));
};

export const getSavingsOpportunities = () => {
  const opportunities = [];

  materials.forEach((material) => {
    const stats = getMaterialVendorStats(material.id);
    if (stats.length < 2) return;

    // Find the vendor we bought most from recently (current vendor)
    const currentVendor = stats.sort((a, b) => new Date(b.lastPurchaseDate) - new Date(a.lastPurchaseDate))[0];
    
    // Find the vendor with the best price that has acceptable quality
    const bestVendor = [...stats]
      .filter((v) => v.vendorId !== currentVendor.vendorId && v.qualityPercent >= 80)
      .sort((a, b) => a.minPrice - b.minPrice)[0];

    if (bestVendor && bestVendor.minPrice < currentVendor.lastPrice) {
      const savingsPerUnit = currentVendor.lastPrice - bestVendor.minPrice;
      // Estimate annual quantity based on total historical quantity
      const estAnnualQty = currentVendor.totalQuantity + bestVendor.totalQuantity; 
      const estAnnualSaving = savingsPerUnit * estAnnualQty;

      if (estAnnualSaving > 0) {
        opportunities.push({
          materialId: material.id,
          materialName: material.name,
          currentVendorName: currentVendor.vendorName,
          currentPrice: currentVendor.lastPrice,
          bestVendorName: bestVendor.vendorName,
          bestPrice: bestVendor.minPrice,
          savingsPerUnit,
          estAnnualSaving,
        });
      }
    }
  });

  return opportunities.sort((a, b) => b.estAnnualSaving - a.estAnnualSaving);
};

export const getInventoryValuation = () => {
  return materials.reduce((total, mat) => {
    // get average price from purchases to value stock
    const matPurchases = purchases.filter(p => p.materialId === mat.id);
    if (matPurchases.length === 0) return total;
    const avgPrice = matPurchases.reduce((sum, p) => sum + p.unitPrice, 0) / matPurchases.length;
    return total + (mat.currentStock * avgPrice);
  }, 0);
};

export const getSpendThisMonth = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return purchases
    .filter(p => new Date(p.date) >= startOfMonth)
    .reduce((sum, p) => sum + p.totalValue, 0);
};
