package com.planora.backend.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.AbstractList;

import org.junit.jupiter.api.Test;

class ListToJsonConverterTest {

    private final ListToJsonConverter converter = new ListToJsonConverter();

    @Test
    void convertsListsInBothDirections() {
        List<String> original = List.of("one", "quoted \"value\"", "unicode-✓");
        String stored = converter.convertToDatabaseColumn(original);

        assertEquals(original, converter.convertToEntityAttribute(stored));
        assertEquals(List.of(), converter.convertToEntityAttribute(converter.convertToDatabaseColumn(List.of())));
    }

    @Test
    void nullAndMalformedValuesReturnNull() {
        assertNull(converter.convertToDatabaseColumn(null));
        assertNull(converter.convertToEntityAttribute(null));
        assertNull(converter.convertToEntityAttribute("not-json"));
        assertNull(converter.convertToEntityAttribute("{\"not\":\"a-list\"}"));
    }

    @Test
    void serializationFailureReturnsNull() {
        List<String> broken = new AbstractList<>() {
            @Override
            public String get(int index) {
                throw new IllegalStateException("fixture cannot be serialized");
            }

            @Override
            public int size() {
                return 1;
            }
        };

        assertNull(converter.convertToDatabaseColumn(broken));
    }
}
