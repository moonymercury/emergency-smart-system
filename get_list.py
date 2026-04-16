import requests
import pandas as pd

def get_complete_taxonomy():
    print("🚀 啟動深度挖掘模式：正在抓取 OFF 全量添加物標籤雲...")
    url = "https://world.openfoodfacts.org/data/taxonomies/additives.json"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(url, headers=headers, timeout=60)
        data = response.json()
        
        full_list = []
        
        for key, value in data.items():
            # 1. 提取所有語言的名稱 (Name Dictionary)
            names_dict = value.get('name', {})
            
            # 2. 提取別名 (Synonyms / Full Names)
            # 有些名稱藏在 value['name']['en'] 之外的地方
            potential_names = list(names_dict.values())
            
            # 3. 取得法規編號
            e_code = key.split(':')[-1].upper() if 'en:e' in key else "Non-E"
            
            # 4. 取得分類
            parents = value.get('parents', [])
            main_cat = parents[0].split(':')[-1].capitalize() if parents else "Mixture/Component"

            # 遍歷該節點下所有可能的名稱 (中文、英文、德文等)
            for n in potential_names:
                name_clean = str(n).strip()
                if len(name_clean) > 2 and ":" not in name_clean:
                    full_list.append({
                        'search_name': name_clean, # 用於 PubChem 搜尋
                        'e_number': e_code,
                        'category': main_cat,
                        'original_tag': key        # 紀錄原始標籤以便追蹤
                    })
        
        df = pd.DataFrame(full_list)
        
        # 關鍵：這裡不做「去重」，因為同一個 E-number 的不同語言別名對我們很有用
        # 我們只移除完全一模一樣的行
        df = df.drop_duplicates()
        
        # 將結果存檔
        df.to_csv('top_1000_additives.csv', index=False)
        print(f"🎉 深度挖掘完成！已獲取 {len(df)} 筆添加物項（含多語系與別名）。")
        print(f"範例結果：\n{df.sample(min(10, len(df)))}")

    except Exception as e:
        print(f"❌ 挖掘失敗: {e}")

if __name__ == "__main__":
    get_complete_taxonomy()