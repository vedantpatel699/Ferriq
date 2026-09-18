"""Provisional tag mapping only. No AVEVA endpoint, SDK or credentials.

The caller supplies records with timestamp and tags dictionaries. A tagMap
maps each site tag to a documented engine field and canonical unit. No implicit
unit conversion is made. Site-specific AVEVA extraction belongs upstream.
"""
def map_records(model, records, tag_map, config=None, source='unspecified'):
    measurements=[]
    for record in records:
        values,quality={},{}
        for tag,mapping in tag_map.items():
            field=mapping['field'];item=record.get('tags',{}).get(tag)
            if item is None:values[field]=None;quality[field]='missing';continue
            if item.get('unit')!=mapping['unit']:raise ValueError('Unit mismatch for '+tag)
            values[field]=item.get('value');quality[field]=item.get('quality','good')
        measurements.append({'timestamp':record['timestamp'],'values':values,'quality':quality})
    return {'schemaVersion':'1.0','model':model,'source':source,'timezone':'America/Edmonton','config':config or {},'measurements':measurements}
