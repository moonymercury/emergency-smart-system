import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from rdkit import Chem, DataStructs
from rdkit.Chem import AllChem
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

class MASA_Research_System:
    """
    MASA (Molecular Additive Synergy Analysis) 研究系統
    整合數據標準化、空間分析、危害指標運算與市場偵測功能。
    """
    def __init__(self, data_path='molecular_features.csv'):
        # 初始化載入資料，並過濾掉無法運算的缺失值
        self.data_path = data_path
        self.df = pd.read_csv(data_path).dropna(subset=['smiles', 'xlogp', 'tpsa'])
        self.sim_matrix = None

    # --- 模組一：數據特徵化 (Data Engine) ---
    def module_1_featurization(self):
        print("M1: 執行特徵標準化與特徵工程...")
        # 定義我們希望擁有的所有特徵
        all_possible_features = ['mw', 'xlogp', 'tpsa', 'h_bond_donor_count', 'h_bond_acceptor_count']
        
        # 動態檢查 CSV 中實際存在的欄位
        available_features = [f for f in all_possible_features if f in self.df.columns]
        print(f"   -> 實際偵測到的特徵欄位: {available_features}")

        if not available_features:
            raise ValueError("錯誤：CSV 檔案中找不到任何可用的數值特徵欄位！")

        for col in available_features:
            self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0)
            
        scaler = StandardScaler()
        # 僅針對存在的欄位進行標準化
        self.df['norm_load'] = scaler.fit_transform(self.df[available_features]).sum(axis=1)
        return self.df

    # --- 模組二：化學空間與相似度 (Space Analyzer) ---
    def module_2_similarity_analysis(self):
        """
        計算 Tanimoto 相似度矩陣並執行 PCA 降維視覺化。
        這能找出物理化學性質重疊的添加物群落。
        """
        print("M2: 計算相似度矩陣與 PCA 空間映射...")
        
        # 轉換 SMILES 為分子指紋
        mols = [Chem.MolFromSmiles(s) for s in self.df['smiles']]
        fps = [AllChem.GetMorganFingerprintAsBitVect(m, 2, nBits=2048) for m in mols]
        
        # 計算相似度矩陣 (Tanimoto Coefficient)
        n = len(fps)
        matrix = np.zeros((n, n))
        for i in range(n):
            matrix[i] = DataStructs.BulkTanimotoSimilarity(fps[i], fps)
        
        self.sim_matrix = pd.DataFrame(matrix, index=self.df['queried_name'], columns=self.df['queried_name'])
        
        # 執行 PCA 降維 (2D)
        pca = PCA(n_components=2)
        pca_features = ['mw', 'xlogp', 'tpsa']
        coords = pca.fit_transform(StandardScaler().fit_transform(self.df[pca_features]))
        self.df['pca_1'], self.df['pca_2'] = coords[:, 0], coords[:, 1]
        
        # 繪製化學空間圖
        plt.figure(figsize=(10, 6))
        sns.scatterplot(data=self.df, x='pca_1', y='pca_2', hue='xlogp', size='mw', palette='rocket')
        plt.title('Chemical Space: Food Additives Distribution')
        plt.savefig('chemical_space_map.png')
        
        return self.sim_matrix

    # --- 模組三：合作危害指標計算 (Synergy Scorer) ---
    def module_3_cooperative_hazard(self):
        """
        運算四大合作危害指標：
        PCI: 代謝壅塞 (結構相似度)
        BDS: 屏障破壞 (乳化劑特徵)
        CIB: 載體效應 (脂溶性累積)
        """
        # 針對有結構的：計算 PCI, CIB (原有邏輯)
        print("M3: 運算四大合作危害指標 (PCI, BDS, CIB)...")
        
        # 1. PCI: 計算與其他物質的平均相似度，代表競爭潛力
        self.df['PCI'] = [self.sim_matrix.loc[name].mean() for name in self.df['queried_name']]
        
        # 2. BDS: 偵測界面活性特徵 (高 TPSA + 高 MW 為潛在屏障破壞者)
        self.df['BDS'] = self.df.apply(lambda r: 1.0 if r['tpsa'] > 100 and r['mw'] > 250 else 0.1, axis=1)
        
        # 3. CIB: 脂溶性貢獻度 (標準化 XLogP)
        self.df['CIB'] = self.df['xlogp'] / 10.0
        
        # 綜合協同得分 (Synergy Score)
        self.df['synergy_score'] = (self.df['PCI'] + self.df['BDS'] + self.df['CIB']).round(3)
        
        # 針對無結構的 (None SMILES)：
        for index, row in self.df.iterrows():
            if pd.isna(row['smiles']):
                # 這是你的研究方向：混合物補償
                # 假設它是乳化劑，給予極高的 BDS (屏障破壞) 基本分
                if "E4" in str(row['queried_name']): # E4開頭多為乳化/增稠劑
                    self.df.at[index, 'BDS'] = 1.2  # 強制加權
                    self.df.at[index, 'synergy_score'] = 1.5 # 混合物基礎風險
        
        return self.df.sort_values(by='synergy_score', ascending=False)

    # --- 模組四：機制驗證準備 (Mech-Validator Prep) ---
    def module_4_docking_prep(self):
        """
        選取得分最高前 10% 的高風險物質，作為分子對接 (Docking) 實驗的候選對象。
        """
        print("M4: 篩選高風險組合以供後續對接模擬...")
        threshold = self.df['synergy_score'].quantile(0.9)
        high_risk = self.df[self.df['synergy_score'] >= threshold]
        return high_risk[['queried_name', 'smiles', 'synergy_score']]

    # --- 模組五：市場偵測與產品分析 (Market Guardian) ---
    def module_5_gap_finder(self, product_ingredients):
        """
        模擬市售產品成分清單，計算該產品的總體協同風險得分。
        """
        print(f"M5: 掃描產品成分組合: {product_ingredients}")
        product_df = self.df[self.df['queried_name'].isin(product_ingredients)]
        
        if product_df.empty:
            return 0
            
        total_risk = product_df['synergy_score'].sum()
        # 額外計算混合物多樣性懲罰 (成分越多，交互作用越複雜)
        diversity_penalty = len(product_df) * 0.1
        return round(total_risk + diversity_penalty, 2)
    
    # --- 模組六：機器學習模型預測 (ML Risk Engine) ---
    def module_6_train_ml_model(self):
        """
        利用隨機森林學習現有的分子特徵與 synergy_score 之間的關係。
        """
        print("\nM6: 正在訓練隨機森林風險預測模型...")
        
        # 準備訓練特徵 (X) 與 標籤 (y)
        features = ['mw', 'xlogp', 'tpsa', 'PCI', 'BDS', 'CIB']
        X = self.df[features]
        y = self.df['synergy_score']
        
        # 拆分訓練集與測試集 (80/20)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # 建立隨機森林回歸模型
        self.ml_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.ml_model.fit(X_train, y_train)
        
        # 計算模型準確度 (R^2 Score)
        score = self.ml_model.score(X_test, y_test)
        print(f"✅ 模型訓練完成！準確度 (R^2): {score:.4f}")
        
        # 顯示特徵重要性 (Feature Importance)
        importances = pd.Series(self.ml_model.feature_importances_, index=features)
        print("\n📊 機器學習判定之風險影響因素排名:")
        print(importances.sort_values(ascending=False))
        
        return self.ml_model

    def predict_product_risk_ml(self, product_ingredients):
        """
        使用訓練好的 ML 模型來預測新產品組合的風險。
        """
        product_df = self.df[self.df['queried_name'].isin(product_ingredients)]
        if product_df.empty: return 0
        
        # 提取特徵並預測
        features = ['mw', 'xlogp', 'tpsa', 'PCI', 'BDS', 'CIB']
        preds = self.ml_model.predict(product_df[features])
        
        # 混合物風險 = 平均風險 * 成分數量加權
        total_ml_risk = np.mean(preds) * (1 + len(product_ingredients) * 0.1)
        return round(total_ml_risk, 3)

# --- 主程式執行流程 ---
if __name__ == "__main__":
    # 0. 初始化系統
    masa = MASA_Research_System('molecular_features.csv')
    
    # 1. 數據特徵化 (M1) & 空間相似度分析 (M2)
    masa.module_1_featurization()
    masa.module_2_similarity_analysis()
    
    # 2. 運算傳統協同危害指標 (M3)
    results = masa.module_3_cooperative_hazard()
    
    # 3. 訓練機器學習模型 (M6) - 學習特徵與風險的非線性關係
    # 此步驟會顯示哪些化學特徵（如 XLogP 或 PCI）對風險貢獻最大
    masa.module_6_train_ml_model()
    
    # --- 研究結果展示 ---
    print("\n🔬 [研究發現] 高協同風險添加物 Top 5 (基於 M3 計算):")
    print(results[['queried_name', 'synergy_score', 'PCI', 'BDS', 'xlogp']].head())
    
    # 4. 機制驗證準備 (M4) - 篩選需要進行分子對接的候選名單
    docking_candidates = masa.module_4_docking_prep()
    print(f"\n🧪 [機制驗證] 已篩選出 {len(docking_candidates)} 個高風險候選分子，建議進行 Molecular Docking。")

    # 5. 真實產品模擬分析 (M5 + ML 預測)
    # 測試一個常見的組合：兩種相似抗氧化劑 + 一種乳化劑
    test_product = ["Butylated hydroxyanisole", "Butylated hydroxytoluene", "Polysorbate 80"]
    
    # 傳統公式計算
    traditional_risk = masa.module_5_gap_finder(test_product)
    
    # 機器學習預測
    ml_risk_prediction = masa.predict_product_risk_ml(test_product)
    
    print(f"\n📢 [產品監測報告] 測試組合: {test_product}")
    print(f"   - 傳統協同風險得分: {traditional_risk}")
    print(f"   - AI 機器學習預測風險: {ml_risk_prediction}")
    
    # 6. 劑量溢出判斷 (基於 ML 模型)
    threshold = 1.2  # 設定風險門檻
    if ml_risk_prediction > threshold:
        print(f"   ⚠️ 警報：該產品組合之協同效應預期將導致『生理等效劑量』溢出！")
    else:
        print(f"   ✅ 該產品組合之交互風險在可控範圍內。")

    # 7. 儲存研究結果
    results.to_csv('research_final_results.csv', index=False)
    print("\n✅ 完整研究數據與 ML 特徵分析已儲存至 research_final_results.csv")