import pubchempy as pcp
import pandas as pd
import time
import os
import re

def fetch_comprehensive_data(input_file='top_1000_additives.csv', output_file='molecular_features.csv'):
    # 1. 載入深度挖掘的清單
    if not os.path.exists(input_file):
        print(f"❌ 找不到來源檔案 {input_file}，請先執行 get_list_full.py")
        return
    
    df_input = pd.read_csv(input_file)
    print(f"🚀 啟動整合抓取任務，總計 {len(df_input)} 筆名稱項目...")

    # 2. 斷點續傳邏輯
    if os.path.exists(output_file):
        df_existing = pd.read_csv(output_file)
        processed_names = set(df_existing['queried_name'].tolist())
    else:
        df_existing = pd.DataFrame()
        processed_names = set()

    new_results = []

    # 3. 執行檢索迴圈
    for i, row in df_input.iterrows():
        name = str(row['search_name'])
        if name in processed_names:
            continue
            
        print(f"[{i+1}/{len(df_input)}] 正在檢索: {name}...")
        
        try:
            # 向 PubChem 索取化合物
            cs = pcp.get_compounds(name, 'name')
            
            if cs:
                c = cs[0]
                # --- CAS 提取邏輯 ---
                # 從 synonyms 中尋找符合 CAS 格式的字串 (如 50-81-7)
                synonyms = c.synonyms
                cas = "Unknown"
                for s in synonyms:
                    if re.match(r'^\d{2,7}-\d{2}-\d$', s):
                        cas = s
                        break
                
                new_results.append({
                    'queried_name': name,
                    'e_number': row['e_number'],
                    'category': row['category'],
                    'cas_number': cas,
                    'smiles': c.smiles,
                    'mw': c.molecular_weight,
                    'xlogp': c.xlogp,
                    'tpsa': c.tpsa,
                    'is_complex_mixture': False
                })
                print(f"✅ 找到結構! CAS: {cas}")
            else:
                # --- 標記為複雜混合物 ---
                new_results.append({
                    'queried_name': name,
                    'e_number': row['e_number'],
                    'category': row['category'],
                    'cas_number': "Mixture_No_CAS",
                    'smiles': None,
                    'mw': None,
                    'xlogp': None,
                    'tpsa': None,
                    'is_complex_mixture': True
                })
                print(f"📦 標記為複雜混合物: {name}")

            # 遵守 API 速率限制
            time.sleep(0.5)

        except Exception as e:
            print(f"🛑 錯誤 ({name}): {e}")
            time.sleep(2)

        # 4. 定期備份與合併 (每 20 筆)
        if (i + 1) % 20 == 0 and new_results:
            df_new = pd.DataFrame(new_results)
            df_existing = pd.concat([df_existing, df_new], ignore_index=True)
            
            # --- 別名自動合併邏輯 ---
            # 當同一個 CAS 出現多次時，記錄所有的 queried_name
            df_existing['all_synonyms'] = df_existing.groupby('cas_number')['queried_name'].transform(lambda x: ', '.join(x.unique()))
            
            df_existing.to_csv(output_file, index=False)
            new_results = [] # 清空暫存
            print(f"💾 進度存檔成功，目前唯一物質數: {df_existing['cas_number'].nunique()}")

    # 最終存檔
    if new_results:
        df_new = pd.DataFrame(new_results)
        df_existing = pd.concat([df_existing, df_new], ignore_index=True)
        df_existing.to_csv(output_file, index=False)
    
    print("\n🎉 任務全數完成！")

if __name__ == "__main__":
    fetch_comprehensive_data()