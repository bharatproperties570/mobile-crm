
import os

filepath = "/Applications/Bharat Properties/mobile-app/app/add-inventory.tsx"
with open(filepath, "r") as f:
    lines = f.readlines()

start_marker = "// ─── Builtup Detail/Type Fetching effects ───────────────────────────────────"
end_marker = "    useEffect(() => {\n"
replacement_end_marker = "    useEffect(() => {\n        const fetchSystemData = async () => {"

# We want to replace the useEffect block following the start_marker until the next useEffect
new_lines = []
skip = False
found_marker = False

new_code = """    useEffect(() => {
        const fetchBuiltupDetail = async () => {
            if (!form.subCategory) { setBuiltupDetailLookups([]); return; }
            try {
                const scRes = await api.get("/lookups", { params: { lookup_type: 'SubCategory', lookup_value: form.subCategory } });
                const scId = scRes.data?.data?.[0]?._id;
                if (!scId) { setBuiltupDetailLookups([]); return; }
                const ptRes = await api.get("/lookups", { params: { lookup_type: 'PropertyType', parent_lookup_id: scId } });
                setBuiltupDetailLookups((ptRes.data?.data || []).map((pt: any) => ({ label: pt.lookup_value, value: pt.lookup_value, _id: pt._id })));
            } catch (e) { console.error("Builtup Detail fetch failed", e); }
        };
        fetchBuiltupDetail();
    }, [form.subCategory]);

    useEffect(() => {
        const fetchBT = async () => {
            if (!form.builtupDetail) { setBtLookups([]); return; }
            try {
                const pt = builtupDetailLookups.find(opt => opt.value === form.builtupDetail);
                if (!pt?._id) { setBtLookups([]); return; }
                const btRes = await api.get("/lookups", { params: { lookup_type: 'BuiltupType', parent_lookup_id: pt._id, limit: 1000 } });
                setBtLookups((btRes.data?.data || []).map((bt: any) => ({ label: bt.lookup_value, value: bt.lookup_value })));
            } catch (e) { console.error("BT fetch failed", e); }
        };
        fetchBT();
    }, [form.builtupDetail, builtupDetailLookups]);

"""

for line in lines:
    if start_marker in line:
        new_lines.append(line)
        new_lines.append(new_code)
        skip = True
        found_marker = True
        continue
    
    if skip and "useEffect(() => {" in line and "fetchSystemData" in lines[lines.index(line)+1]:
        skip = False
    
    if not skip:
        new_lines.append(line)

if found_marker:
    with open(filepath, "w") as f:
        f.writelines(new_lines)
    print("Successfully updated the file.")
else:
    print("Could not find the start marker.")
